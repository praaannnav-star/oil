// Survey templates — Site Inspection & Progress Survey (decision D1 defaults)
export const SURVEY_TEMPLATES = [
  {
    id: 'TPL-SITE-INSPECTION',
    name: 'Site Inspection (Safety & Compliance)',
    icon: '🛡️',
    description: 'Structured HSE walkthrough checklist with photo evidence',
    questions: [
      { id: 'q_housekeeping', type: 'radio', label: 'Site housekeeping compliant?', options: ['Yes', 'No', 'Partial'], required: true },
      { id: 'q_ppe', type: 'radio', label: 'PPE compliance observed across workface?', options: ['Yes', 'No', 'Partial'], required: true },
      { id: 'q_permits', type: 'radio', label: 'Work permits displayed & valid?', options: ['Yes', 'No', 'N/A'], required: true },
      { id: 'q_hazards', type: 'text', label: 'Hazards / near-miss observations', placeholder: 'Describe any hazards, near misses or unsafe conditions...', voice: true },
      { id: 'q_overall', type: 'radio', label: 'Overall inspection outcome', options: ['Pass', 'Fail - Action Required', 'Conditional Pass'], required: true }
    ]
  },
  {
    id: 'TPL-PROGRESS-SURVEY',
    name: 'Daily Progress Survey',
    icon: '📊',
    description: 'Quantitative daily workfront status for schedule reconciliation',
    questions: [
      { id: 'q_activity', type: 'text', label: 'Activity / workface covered today', placeholder: 'e.g., Foundation B2 shuttering, Chainage 42-47 trenching...', required: true, voice: true },
      { id: 'q_quantity', type: 'text', label: 'Quantity installed today', placeholder: 'e.g., 45 cum concrete, 380 inch dia welds...', required: true },
      { id: 'q_crew', type: 'number', label: 'Crew size on site', placeholder: 'e.g., 24', required: true },
      { id: 'q_tomorrow', type: 'radio', label: 'Workface ready for tomorrow?', options: ['Yes', 'No - constraint exists'], required: true },
      { id: 'q_constraint', type: 'text', label: 'If blocked, describe the constraint', placeholder: 'Material shortage, weather, equipment breakdown...', voice: true },
      { id: 'q_pct', type: 'number', label: 'Estimated % complete for this activity', placeholder: '0-100' }
    ]
  }
];
