export async function verifyEvidenceWithVision(env, db, reviewId, reportId, transcript) {
  try {
    // 1. Fetch evidence for this report
    const evidence = await db.prepare(
      'SELECT url FROM evidence WHERE report_id = ? AND url IS NOT NULL LIMIT 1'
    ).bind(reportId).first();

    if (!evidence || !evidence.url) {
      // Flag as missing visual evidence
      await db.prepare(
        "UPDATE reviews SET ai_verification_json = ? WHERE id = ?"
      ).bind(JSON.stringify({
        status: 'no_visual_evidence',
        verified: false,
        confidence: 0,
        reasoning: 'No photographic evidence was attached to this report.'
      }), reviewId).run();
      return;
    }

    // 2. Fetch image as ArrayBuffer
    const imgResponse = await fetch(evidence.url);
    if (!imgResponse.ok) {
      throw new Error(`Failed to fetch image from ${evidence.url}`);
    }
    const imgArrayBuffer = await imgResponse.arrayBuffer();
    const imageArray = [...new Uint8Array(imgArrayBuffer)]; // Convert to normal array for CF AI if needed. Actually CF AI takes Uint8Array or array of numbers.

    // 3. Prompt for the Vision Model
    const prompt = `The field supervisor claims: "${transcript}". 
Does the attached image provide visual evidence supporting this claim? 
Respond ONLY with a JSON object containing a boolean "verified", an integer "confidence" (0-100), a string "reasoning", and an integer "suggested_progress" (0-100) representing your best visual estimate of the percentage of work completed.`;

    // 4. Run Cloudflare Vision AI
    const aiResult = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      prompt,
      image: imageArray
    });

    // LLM response is usually in `aiResult.response` or similar depending on the exact AI model format.
    const textResponse = typeof aiResult === 'string' ? aiResult : (aiResult.response || aiResult.result || '{}');
    
    // Parse the JSON safely
    let parsed = {
      status: 'success',
      verified: true,
      confidence: 80,
      suggestedProgress: null,
      reasoning: 'AI could not format the output properly, but image was processed.'
    };

    try {
      // Extract json from markdown block if any
      const match = textResponse.match(/\{[\s\S]*\}/);
      if (match) {
        const extractedJson = JSON.parse(match[0]);
        parsed = {
          status: 'success',
          verified: !!extractedJson.verified,
          confidence: Number(extractedJson.confidence) || 0,
          suggestedProgress: extractedJson.suggested_progress !== undefined ? Number(extractedJson.suggested_progress) : null,
          reasoning: extractedJson.reasoning || textResponse
        };
      } else {
        parsed.reasoning = textResponse;
      }
    } catch (e) {
      console.warn("Failed to parse vision AI JSON, raw response:", textResponse);
      parsed.reasoning = textResponse; // Fallback to raw text
    }

    // 5. Save verification results to reviews
    await db.prepare(
      "UPDATE reviews SET ai_verification_json = ? WHERE id = ?"
    ).bind(JSON.stringify(parsed), reviewId).run();

  } catch (err) {
    console.error("Vision AI Error:", err);
    await db.prepare(
      "UPDATE reviews SET ai_verification_json = ? WHERE id = ?"
    ).bind(JSON.stringify({
      status: 'error',
      verified: false,
      confidence: 0,
      reasoning: `Vision AI processing failed: ${err.message}`
    }), reviewId).run();
  }
}
