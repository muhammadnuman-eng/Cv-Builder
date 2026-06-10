import api from './api'

export const tailorCV = (cvSections, cvLayout, jobDescription, originalFormat) =>
  api.post('/ai/tailor', {
    cv_sections: cvSections,
    cv_layout: cvLayout,
    job_description: jobDescription,
    original_format: originalFormat
  })

export const analyzeJD = (jobDescription) =>
  api.post('/ai/analyze-jd', { job_description: jobDescription })
