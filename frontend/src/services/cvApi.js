import api from './api'

export const uploadCV = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/storage/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const parseCV = (filename) =>
  api.post('/parser/parse', { filename })

export const generateCV = (tailoredSections, cvLayout, outputFormat, originalFormat, originalFilename) =>
  api.post('/generator/generate', {
    tailored_sections: tailoredSections,
    cv_layout: cvLayout,
    output_format: outputFormat,
    original_format: originalFormat,
    original_filename: originalFilename
  })

const MIME_TYPES = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export const downloadGeneratedFile = async (filename) => {
  const res = await api.get(`/generator/download/${filename}`, { responseType: 'blob' })
  const ext = filename.split('.').pop().toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
  const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
