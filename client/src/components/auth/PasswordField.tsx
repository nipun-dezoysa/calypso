import { useState } from 'react'
import { IoEye, IoEyeOff } from 'react-icons/io5'

interface PasswordFieldProps {
    id: string
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    autoComplete?: string
    autoFocus?: boolean
    disabled?: boolean
    hint?: string
}

function PasswordField({
    id,
    label,
    value,
    onChange,
    placeholder,
    autoComplete = 'current-password',
    autoFocus = false,
    disabled = false,
    hint,
}: PasswordFieldProps) {
    const [visible, setVisible] = useState(false)

    return (
        <div className="form-field">
            <label className="form-label" htmlFor={id}>
                {label}
                {hint && <span className="form-label-optional">{hint}</span>}
            </label>
            <div className="form-pw-wrapper">
                <input
                    id={id}
                    className="form-input"
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    spellCheck={false}
                />
                <button
                    type="button"
                    className="form-pw-toggle"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                >
                    {visible ? <IoEyeOff /> : <IoEye />}
                </button>
            </div>
        </div>
    )
}

export default PasswordField
