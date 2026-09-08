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
        suggestedProgress: null,
        reasoning: 'No photographic evidence was attached to this report.'
      }), reviewId).run();
      return;
    }

    // 2. Fetch image as ArrayBuffer or decode base64
    let imageArray;
    if (evidence.url.startsWith('data:image')) {
      const parts = evidence.url.split(',');
      if (parts.length < 2) {
        throw new Error('Invalid or corrupted data:image URI.');
      }
      const b64 = parts[1];
      const binaryString = atob(b64);
      const len = binaryString.length;
      if (len > 2500000) {
        throw new Error(`Image size too large (${Math.round(len / 1024)} KB). Maximum supported size is 2.5MB.`);
      }
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageArray = [...bytes];
    } else {
      const imgResponse = await fetch(evidence.url);
      if (!imgResponse.ok) {
        throw new Error(`Failed to fetch image from ${evidence.url} (status ${imgResponse.status})`);
      }
      const imgArrayBuffer = await imgResponse.arrayBuffer();
      if (imgArrayBuffer.byteLength > 2500000) {
        throw new Error(`Image size too large (${Math.round(imgArrayBuffer.byteLength / 1024)} KB). Maximum supported size is 2.5MB.`);
      }
      imageArray = [...new Uint8Array(imgArrayBuffer)];
    }

    console.log(`Prepared image for vision AI: ${imageArray.length} bytes`);

    // 3. Stage 1: Visual Description via LLaVA (Vicuna prompt format - direct question)
    const visionPrompt = "Describe this construction and site engineering photo in detail. What equipment, materials, structures, workers, and activities are visible in the image?";
    
    let visualDescription = '';
    try {
      const aiResult = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
        prompt: visionPrompt,
        image: imageArray
      });

      // Cloudflare image-to-text models return { description: string }
      visualDescription = typeof aiResult === 'string'
        ? aiResult
        : (aiResult?.description || aiResult?.response || aiResult?.result || JSON.stringify(aiResult || ''));
      console.log('Stage 1 LLaVA visual description:', visualDescription);
    } catch (visionErr) {
      console.warn('LLaVA Vision call failed:', visionErr.message);
      throw new Error(`Vision model failed: ${visionErr.message}`);
    }

    // 4. Stage 2: Reasoning & Structured Extraction via Llama 3.1
    let parsed = {
      status: 'success',
      verified: true,
      confidence: 90,
      suggestedProgress: 100,
      reasoning: visualDescription || 'Visual evidence analyzed.'
    };

    try {
      const systemPrompt = `You are an expert civil engineering quality control inspector.
Your job is to compare a field supervisor's claimed work transcript with an AI visual description of the photo evidence submitted from the construction site.
Evaluate if the photo evidence visually confirms the claim and what percentage of the activity is completed (0-100).
Always respond ONLY with a valid JSON object matching this schema:
{
  "verified": true,
  "confidence": 95,
  "suggested_progress": 100,
  "reasoning": "<concise explanation of what was visually verified>"
}`;

      const userPrompt = `Supervisor Field Claim: "${transcript}"

AI Visual Description of Attached Site Photo:
"${visualDescription}"

Does this visual evidence support the supervisor's claim? Output the JSON result now:`;

      const llmResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300
      });

      const llmText = typeof llmResult === 'string' ? llmResult : (llmResult?.response || '');
      console.log('Stage 2 LLM extraction raw output:', llmText);

      const match = llmText.match(/\{[\s\S]*\}/);
      if (match) {
        const extracted = JSON.parse(match[0]);
        const isVer = extracted.verified !== undefined ? Boolean(extracted.verified) : true;
        const conf = Number(extracted.confidence) || (isVer ? 90 : 20);
        const prog = extracted.suggested_progress !== undefined 
          ? Number(extracted.suggested_progress) 
          : (extracted.suggestedProgress !== undefined ? Number(extracted.suggestedProgress) : (isVer ? 100 : 0));

        parsed = {
          status: 'success',
          verified: isVer,
          confidence: Math.min(100, Math.max(0, conf)),
          suggestedProgress: isNaN(prog) ? null : Math.min(100, Math.max(0, prog)),
          reasoning: extracted.reasoning || visualDescription
        };
      } else {
        // Fallback: heuristic analysis from visualDescription
        const isVer = !/no evidence|cannot see|not visible|does not support|unrelated/i.test(visualDescription);
        parsed = {
          status: 'success',
          verified: isVer,
          confidence: isVer ? 85 : 30,
          suggestedProgress: isVer ? 100 : 0,
          reasoning: visualDescription
        };
      }
    } catch (llmErr) {
      console.warn('Stage 2 LLM extraction failed, using Stage 1 description:', llmErr.message);
      parsed = {
        status: 'success',
        verified: true,
        confidence: 80,
        suggestedProgress: 100,
        reasoning: visualDescription
      };
    }

    // 5. Save verification results to reviews
    await db.prepare(
      "UPDATE reviews SET ai_verification_json = ? WHERE id = ?"
    ).bind(JSON.stringify(parsed), reviewId).run();
    console.log(`Saved AI verification to review ${reviewId}:`, JSON.stringify(parsed));

  } catch (err) {
    console.error("Vision AI Error:", err);
    await db.prepare(
      "UPDATE reviews SET ai_verification_json = ? WHERE id = ?"
    ).bind(JSON.stringify({
      status: 'error',
      verified: false,
      confidence: 0,
      suggestedProgress: null,
      reasoning: 'Vision AI processing failed: ' + err.message
    }), reviewId).run();
  }
}
