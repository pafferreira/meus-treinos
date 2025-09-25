import { fireEvent, render, screen } from '@testing-library/react'
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

  it('mantem um unico avatar para Benfit', () => {
    render(<App />)
    expect(screen.getAllByAltText(/Avatar Benfit/i)).toHaveLength(1)
  })

  it('permite ao usuario escolher entre diversos avatares', () => {
    render(<App />)
    const avatarButtons = screen.getAllByRole('button', { name: /Selecionar avatar/i })
    expect(avatarButtons.length).toBeGreaterThanOrEqual(10)
    fireEvent.click(avatarButtons[1])
    expect(avatarButtons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(avatarButtons[0]).toHaveAttribute('aria-pressed', 'false')
  })

  it('permite gerar e salvar um novo plano de treino', async () => {
    render(<App />)
    const [navCreateButton] = screen.getAllByRole('button', { name: /Criar novo treino/i })
    fireEvent.click(navCreateButton)
    fireEvent.click(screen.getByRole('button', { name: /Gerar sessoes/i }))
    const saveButton = screen.getByRole('button', { name: /Salvar plano/i })
    expect(saveButton).not.toBeDisabled()
    fireEvent.click(saveButton)
    expect(await screen.findByText(/Exercicios – Treino/i)).toBeInTheDocument()
    const exercises = await screen.findAllByText(/Supino reto/i)
    expect(exercises.length).toBeGreaterThan(0)
  })
})
