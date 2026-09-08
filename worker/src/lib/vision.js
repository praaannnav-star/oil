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

    // 2. Fetch image as ArrayBuffer or decode base64
    let imageArray;
    if (evidence.url.startsWith('data:image')) {
      const b64 = evidence.url.split(',')[1];
      const binaryString = atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageArray = [...bytes];
    } else {
      const imgResponse = await fetch(evidence.url);
      if (!imgResponse.ok) {
        throw new Error(`Failed to fetch image from ${evidence.url}`);
      }
      const imgArrayBuffer = await imgResponse.arrayBuffer();
      imageArray = [...new Uint8Array(imgArrayBuffer)];
    }

    // 3. Prompt for the Vision Model
    const prompt = `[INST] You are an expert civil & construction quality inspector reviewing photo evidence.
The supervisor claims: "${transcript}".
Question: Does this construction photo visually support the claim?
Return ONLY a valid JSON object formatted exactly like this:
{"verified": true, "confidence": 100, "suggested_progress": 100, "reasoning": "Observed steel rebar and foundation work matching the report."}
[/INST]`;

    // 4. Run Cloudflare Vision AI
    const aiResult = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      prompt,
      image: imageArray
    });

    // Cloudflare image-to-text models typically return { description: string }
    const textResponse = typeof aiResult === 'string' 
      ? aiResult 
      : (aiResult.description || aiResult.response || aiResult.result || (aiResult && typeof aiResult === 'object' ? JSON.stringify(aiResult) : '{}'));
    console.log('Vision AI raw output:', textResponse);
    
    // Parse the JSON safely
    let parsed = {
      status: 'success',
      verified: true,
      confidence: 100,
      suggestedProgress: 100,
      reasoning: 'Image evidence analyzed.'
    };

    try {
      const match = textResponse.match(/\{[\s\S]*\}/);
      if (match) {
        const extractedJson = JSON.parse(match[0]);
        const hasVerified = extractedJson.verified !== undefined;
        const isVerified = hasVerified ? Boolean(extractedJson.verified) : /yes|verified|completed|complete|rebar|foundation|construction/i.test(textResponse);
        const conf = extractedJson.confidence !== undefined ? Number(extractedJson.confidence) : (isVerified ? 100 : 0);
        const prog = (extractedJson.suggested_progress !== undefined ? extractedJson.suggested_progress : extractedJson.suggestedProgress);
        const progressVal = prog !== undefined ? Number(prog) : (isVerified ? 100 : null);

        parsed = {
          status: 'success',
          verified: isVerified,
          confidence: isNaN(conf) ? 100 : conf,
          suggestedProgress: progressVal !== null && !isNaN(progressVal) ? progressVal : (isVerified ? 100 : 0),
          reasoning: extractedJson.reasoning || textResponse
        };
      } else {
        const isVerified = /yes|verified|completed|complete|rebar|foundation|worker|construction/i.test(textResponse) && !/not verified|no evidence|does not/i.test(textResponse);
        parsed = {
          status: 'success',
          verified: isVerified,
          confidence: isVerified ? 100 : 20,
          suggestedProgress: isVerified ? 100 : 0,
          reasoning: textResponse
        };
      }
    } catch (e) {
      console.warn("Failed to parse vision AI JSON, raw response:", textResponse);
      const isVerified = /yes|verified|completed|rebar|foundation/i.test(textResponse);
      parsed = {
        status: 'success',
        verified: isVerified,
        confidence: isVerified ? 100 : 30,
        suggestedProgress: isVerified ? 100 : 0,
        reasoning: textResponse
      };
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
      reasoning: 'Vision AI processing failed: ' + err.message + ' | ' + (err.stack || '')
    }), reviewId).run();
  }
}
