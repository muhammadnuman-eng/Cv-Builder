import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import api from '../services/api'

export default function CVUpload({ onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(null)

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      // Use axios api instance so the 401 interceptor handles expired/missing tokens
      // (redirects to /auth/login automatically)
      const res = await api.post('/storage/upload', formData)
      setUploaded(res.data)
      onUploaded(res.data)
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.detail || 'Upload failed')
      }
      // 401 is handled by api.js interceptor: clears token + redirects to login
    } finally {
      setUploading(false)
    }
  }, [onUploaded])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: uploading
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          {uploading ? (
            <p className="text-gray-500 font-medium">Uploading...</p>
          ) : isDragActive ? (
            <p className="text-blue-600 font-medium">Drop your CV here</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium">Drag & drop your CV here</p>
              <p className="text-gray-400 text-sm">or click to browse</p>
              <p className="text-gray-400 text-xs mt-1">Supports PDF and DOCX</p>
            </>
          )}
        </div>
      </div>

      {uploaded && (
        <div className="mt-3 flex items-center gap-2 text-green-600 text-sm font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {uploaded.original_name} uploaded successfully
        </div>
      )}
    </div>
  )
}
