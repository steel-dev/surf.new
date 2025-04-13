# 🌊 surf.new

A playground for testing web agents powered by [Steel.dev](https://steel.dev). Experience how different AI agents can surf and interact with the web just like humans do.

https://github.com/user-attachments/assets/cc50c603-1cb8-49b1-8910-251b6beec228

## 🌟 Features

- Test multiple web agents in a controlled environment
- Real-time browser interaction visualization
- Support for various AI providers (Claude, GPT-4, etc.)
- Built with modern web technologies (Next.js 15, FastAPI, Steel SDK)
- Beautiful UI powered by Shadcn UI and Tailwind CSS

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- [Steel API Key](https://steel.dev) (sign up at steel.dev) or Local running instance

### Installation

1. Clone the repository:

```bash
git clone https://github.com/steel-dev/surf.new
cd surf.new
```

2. Install frontend dependencies:

```bash
npm install
```

3. Install backend dependencies:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

4. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Steel API key and other required variables.

### Running Locally

Run the development server:

```bash
npm run dev
```

> ### Windows Users
>
> If you're developing on Windows, you should use the Windows-specific command:
>
> ```bash
> npm run dev:win
> ```
>
> **Technical Reason:** Windows has two different asyncio event loop implementations:
>
> - **SelectorEventLoop** (default): Uses select-based I/O and doesn't support subprocesses properly
> - **ProactorEventLoop**: Uses I/O completion ports and fully supports subprocesses
>
> Playwright requires subprocess support to launch browsers. When hot reloading is enabled, the default SelectorEventLoop is used, causing a `NotImplementedError` when Playwright tries to create a subprocess.
> Reference Issue: https://github.com/steel-dev/surf.new/issues/32

This will start both the Next.js frontend (port 3001) and FastAPI backend (port 8000).

Visit [http://localhost:3001](http://localhost:3001) to start using surf.new!

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔗 Links

- [Steel.dev](https://steel.dev) - Our main platform
- [Documentation](https://docs.steel.dev)
- [Discord Community](https://discord.gg/steel-dev)
- [Twitter](https://twitter.com/steeldotdev)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💪 Built With

- [Next.js 15](https://nextjs.org/) - React Framework
- [FastAPI](https://fastapi.tiangolo.com/) - Python Backend
- [Steel SDK](https://steel.dev) - Browser Automation
- [Shadcn UI](https://ui.shadcn.com/) - UI Components
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI Chat Interface
- [Langchain](https://python.langchain.com/docs/introduction/) - Agent Framework

## Code Style and Linting

This project uses a consistent code style enforced by linters for both frontend and backend code.

### Frontend (TypeScript/React)

- **ESLint**: Enforces code quality and style rules
- **Prettier**: Ensures consistent code formatting
- **TypeScript**: Provides type checking

### Backend (Python)

- **Ruff**: A fast Python linter and formatter that combines functionality from multiple tools

### Quick Commands

```bash
# Frontend
npm run lint        # Check for issues
npm run lint:fix    # Fix issues automatically
npm run format      # Format code with Prettier

# Backend
npm run lint:py     # Check for issues
npm run lint:py:fix # Fix issues automatically
npm run format:py   # Format Python code
```

---

Made with ❤️ by the Steel team
