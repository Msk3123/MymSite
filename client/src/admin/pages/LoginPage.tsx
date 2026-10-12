import { useState } from 'react'
import { LogoMark } from '../../components/Icons'
import { adminApi, type Me } from '../api'
import { ErrorNote } from '../ui'

export function LoginPage({ onLogin }: { onLogin: (me: Me) => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onLogin(await adminApi.login(login, password))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin a-login">
      <form className="a-card a-login__card" onSubmit={submit}>
        <LogoMark size={44} />
        <h1>Кабінет «Мамина шафа»</h1>
        <label className="field">
          <span className="field__label">Логін</span>
          <input autoComplete="username" autoCapitalize="none" value={login} onChange={(e) => setLogin(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Пароль</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <ErrorNote error={error} />
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Входжу…' : 'Увійти'}
        </button>
        <p className="a-hint">Телефон запам’ятає вхід на місяць.</p>
      </form>
    </div>
  )
}
