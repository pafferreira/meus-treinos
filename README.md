# Meus Treinos

Projeto React + Vite + TypeScript. Pronto para deploy na **Vercel**.

## Scripts
- `npm run dev` – ambiente de desenvolvimento
- `npm run build` – build de produção
- `npm run preview` – pré-visualizar o build

## Como rodar local
```bash
npm install
npm run dev
```

## Deploy na Vercel
1. Crie o repositório **meus-treinos** no seu GitHub e faça push:
   ```bash
   git init
   git add .
   git commit -m "feat: projeto Meus Treinos inicial"
   git branch -M main
   git remote add origin https://github.com/<seu-usuario>/meus-treinos.git
   git push -u origin main
   ```
2. Acesse https://vercel.com → **New Project** → **Import Git Repository** e selecione `meus-treinos`.
3. Framework: **Vite** (auto). Build: `npm run build`. Output: `dist`.
4. Conclua o deploy.

## Observação
Dados ficam em localStorage do navegador. Quando quiser sincronizar entre dispositivos, integramos Supabase/Firebase.
