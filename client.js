/**
 * dsh-plugin-balance — client half.
 *
 * A small pill in the corner of the shell showing the account balance, polled
 * once a minute from GET /dsh-plugin-balance/state (see index.mjs). It registers
 * into `shell.overlay`, the same slot the rea setup guide uses, so it does not
 * depend on any private slot contract.
 *
 * Failure is silent: no data, no pill. A broken route must never clutter the UI.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-balance',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    const react = require('react')
    const h = react.createElement
    const { useEffect, useState } = react

    const ROUTE = '/dsh-plugin-balance/state'
    const POLL_MS = 60 * 1000

    const shell = {
      position: 'fixed',
      top: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      borderRadius: 999,
      background: 'rgba(255, 255, 255, 0.86)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(0, 0, 0, 0.08)',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.10)',
      color: '#1f2429',
      fontSize: 12,
      lineHeight: '16px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      cursor: 'default',
      userSelect: 'none',
      pointerEvents: 'auto',
    }

    const symbol = (currency) => (currency === 'USD' ? '$' : '¥')

    function format(value) {
      if (value === null || value === undefined || !Number.isFinite(value)) return null
      if (value > 0 && value < 0.01) return '<0.01'
      return value.toFixed(2)
    }

    function Pill() {
      const [state, setState] = useState(null)

      useEffect(() => {
        let alive = true
        let timer = 0

        const tick = async () => {
          try {
            const res = await fetch(ROUTE, { cache: 'no-store' })
            const body = await res.json()
            if (alive) setState(body)
          } catch {
            if (alive) setState({ ok: false })
          }
          if (alive) timer = window.setTimeout(tick, POLL_MS)
        }

        tick()
        return () => {
          alive = false
          window.clearTimeout(timer)
        }
      }, [])

      if (!state || !state.ok || state.balance === null || state.balance === undefined) return null

      const shown = format(state.balance)
      if (shown === null) return null

      const detail = (() => {
        try {
          return JSON.stringify(state.raw, null, 2)
        } catch {
          return ''
        }
      })()

      return h(
        'div',
        { style: shell, title: `DeepSeek 账户余额\n${detail}`.trim() },
        h('span', { style: { opacity: 0.6, fontSize: 11 } }, '余额'),
        h('span', { style: { fontWeight: 600 } }, `${symbol(state.currency)}${shown}`),
      )
    }

    exports.name = 'dsh-plugin-balance'
    exports.inject = ['slots']
    exports.apply = (ctx) => {
      if (!ctx || !ctx.slots || typeof ctx.slots.register !== 'function') return
      const mount = () => ctx.slots.register({ name: 'shell.overlay', id: 'balance-pill', order: 65 }, () => h(Pill))
      if (typeof ctx.slots.inject === 'function') ctx.slots.inject('shell.overlay', mount)
      else mount()
    }

    return module.exports
  },
})
