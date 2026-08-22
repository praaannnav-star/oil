// API abstraction layer with seamless mock data vs live Cloudflare Workers switch
import { MOCK_PROJECTS } from '../data/mock-projects.js';
import { MOCK_ACTIVITIES } from '../data/mock-activities.js';
import { MOCK_REPORTS } from '../data/mock-reports.js';
import { MOCK_EVIDENCE } from '../data/mock-evidence.js';
import { MOCK_REVIEW_ITEMS } from '../data/mock-review.js';
import { MOCK_AUDIT_LOG } from '../data/mock-audit.js';

class ApiService {
  constructor() {
    this.useMock = true; // Easily switched to false when Cloudflare Workers endpoint is configured
    this.baseUrl = '/api';

    // In-memory runtime state for demo updates
    this.projects = this.loadProjects();
    this.activities = JSON.parse(JSON.stringify(MOCK_ACTIVITIES));
    this.reports = JSON.parse(JSON.stringify(MOCK_REPORTS));
    this.evidence = JSON.parse(JSON.stringify(MOCK_EVIDENCE));
    this.reviewItems = JSON.parse(JSON.stringify(MOCK_REVIEW_ITEMS));
    this.auditLogs = JSON.parse(JSON.stringify(MOCK_AUDIT_LOG));
  }

  resetDemoData() {
    this.projects = JSON.parse(JSON.stringify(MOCK_PROJECTS));
    this.persistProjects();
    this.activities = JSON.parse(JSON.stringify(MOCK_ACTIVITIES));
    this.reports = JSON.parse(JSON.stringify(MOCK_REPORTS));
    this.evidence = JSON.parse(JSON.stringify(MOCK_EVIDENCE));
    this.reviewItems = JSON.parse(JSON.stringify(MOCK_REVIEW_ITEMS));
    this.auditLogs = JSON.parse(JSON.stringify(MOCK_AUDIT_LOG));
  }

  loadProjects() {
    try {
      const saved = localStorage.getItem('oil_demo_projects');
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.warn('Could not restore demo projects', error);
    }
    return JSON.parse(JSON.stringify(MOCK_PROJECTS));
  }

  persistProjects() {
    try {
      localStorage.setItem('oil_demo_projects', JSON.stringify(this.projects));
    } catch (error) {
      console.warn('Could not persist demo projects', error);
    }
  }

  // Simulated latency for realistic UI transitions
  async delay(ms = 80) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const API = new ApiService();
