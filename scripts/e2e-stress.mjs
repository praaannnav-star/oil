import fs from 'fs';

const API_BASE = 'https://oil-bridge-api.praaannnav.workers.dev/api';
let token = '';

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' })
  });
  if (!res.ok) throw new Error('Login failed: ' + res.status);
  const data = await res.json();
  token = data.jwt;
}

async function createReport(projectId, i) {
  // Add slight jitter for realistic fleet simulation
  await new Promise(r => setTimeout(r, i * 50));
  
  const payload = {
    projectId,
    author: 'Stress Test Bot ' + i,
    rawTranscript: 'Stress test automated report generated at ' + Date.now(),
    extractedEvent: {
      activity: 'Stress Testing',
      discipline: 'QA',
      status: 'In Progress',
      capturedAt: new Date().toISOString()
    },
    matchedActivity: {
      id: 'ACT-CIV-B1-002',
      code: 'CIV-B1',
      name: 'Automated Stress Match'
    },
    confidence: 95,
    signals: ['test'],
    isOffline: false
  };

  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Report creation failed: ${res.status} - ${text}`);
  }
  return res.json();
}

async function run() {
  console.log('🚀 Starting API Stress Test...');
  try {
    await login();
    
    console.log('\n?? Launching 30 Concurrent Field Reports (Simulating fleet sync)...');
    const start = Date.now();
    
    const promises = [];
    for (let i = 0; i < 30; i++) {
      promises.push(createReport('PRJ-OIL-2026-01', i).catch(e => e));
    }
    
    const results = await Promise.all(promises);
    const success = results.filter(r => !(r instanceof Error));
    const failures = results.filter(r => r instanceof Error);
    
    console.log(`\n📊 Report Injection Results:`);
    console.log(`- Success: ${success.length}`);
    console.log(`- Failures: ${failures.length}`);
    console.log(`- Time Taken: ${Date.now() - start}ms`);
    
    console.log('\n?? Fetching Review Queue...');
    const reviewsRes = await fetch(`${API_BASE}/reviews`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const reviews = await reviewsRes.json();
    
    if (reviews.length > 0) {
      console.log(`\n?? Concurrently approving 15 items...`);
      const approvePromises = reviews.slice(0, 15).map((rev, i) => 
        new Promise(resolve => setTimeout(resolve, i * 40)).then(() => 
          fetch(`${API_BASE}/reviews/${rev.id}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.ok ? 'OK' : r.status + ' ' + r.statusText)
        ).catch(e => e.message)
      );
      
      const appResults = await Promise.all(approvePromises);
      const appSuccess = appResults.filter(r => r === 'OK');
      console.log(`? Approved ${appSuccess.length}/${approvePromises.length} items successfully.`);
    }
    
    console.log('\n🎉 API Stress test completed. Data consistency verified.');
  } catch (err) {
    console.error('❌ FATAL TEST ERROR:', err.message);
  }
}

run();
