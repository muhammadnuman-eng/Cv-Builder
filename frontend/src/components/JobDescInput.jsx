import { useState } from 'react'

export default function JobDescInput({ value, onChange, detectedStacks }) {
  const [charCount, setCharCount] = useState(0)

  const handleChange = (e) => {
    setCharCount(e.target.value.length)
    onChange(e.target.value)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">Job Description</label>
        <span className="text-xs text-gray-400">{charCount} chars</span>
      </div>
      <textarea
        className="input resize-none h-56 text-sm"
        placeholder="Paste the full job description here...&#10;&#10;The AI will extract required tech stacks and tailor your CV accordingly."
        value={value}
        onChange={handleChange}
      />

      {detectedStacks && detectedStacks.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2 font-medium">Detected tech stacks:</p>
          <div className="flex flex-wrap gap-2">
            {detectedStacks.map(stack => (
              <span
                key={stack}
                className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full"
              >
                {stack}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
