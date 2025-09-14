import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import App from './App'

describe('App basic render', () => {
  it('renders title', () => {
    render(<App />)
    expect(screen.getByText(/Meus Treinos/i)).toBeInTheDocument()
  })

  it('renders >= symbol safely in diagnostics', () => {
    const { container } = render(<App />)
    expect(container.textContent).toContain('Avatares >= 10')
  })
})
