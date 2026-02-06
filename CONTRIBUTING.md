# Contributing to OpenLCA Sankey Plugin

First off, thank you for considering contributing to OpenLCA Sankey Plugin! It's people like you that make this tool better for the entire openLCA community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)

## 📜 Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow:

- **Be respectful** – Treat everyone with respect and kindness
- **Be constructive** – Provide helpful feedback
- **Be collaborative** – Work together towards common goals
- **Be inclusive** – Welcome diverse perspectives

## 🤔 How Can I Contribute?

### Reporting Bugs

Before creating a bug report:
1. **Check existing issues** – The bug might already be reported
2. **Update to latest version** – The bug might already be fixed
3. **Test in isolation** – Ensure it's not a local configuration issue

When reporting a bug, include:
- **Clear title and description**
- **Steps to reproduce**
- **Expected vs. actual behavior**
- **Screenshots** (if applicable)
- **Environment details** (OS, Python version, Node version, openLCA version)
- **Error messages** (full stack trace if available)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:
- **Use a clear, descriptive title**
- **Provide detailed description** of the proposed functionality
- **Explain why this enhancement would be useful**
- **List any alternative solutions** you've considered
- **Include mockups** (if UI-related)

### Code Contributions

We welcome code contributions for:
- Bug fixes
- New features
- Performance improvements
- Documentation improvements
- UI/UX enhancements
- Test coverage improvements

## 🛠️ Development Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- openLCA 2.6.0 with IPC server enabled
- Git

### Setup Steps

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/openlca-sankey-plugin.git
   cd openlca-sankey-plugin
   ```

2. **Set up Python environment**
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```

3. **Set up Node.js environment**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Start development servers**
   
   Terminal 1 - Backend:
   ```bash
   cd backend
   python main.py
   ```
   
   Terminal 2 - Frontend:
   ```bash
   cd frontend
   npm run dev
   ```

5. **Start openLCA IPC server**
   - Open openLCA 2.6.0
   - Tools → Developer tools → IPC server
   - Port: 8080, then click Start

## 📝 Coding Standards

### Python (Backend)

- **Style Guide** – Follow [PEP 8](https://peps.python.org/pep-0008/)
- **Type Hints** – Use type hints where possible
- **Docstrings** – Use docstrings for functions and classes (Google style)
- **Formatting** – Use `black` for formatting (line length: 100)
- **Linting** – Use `flake8` or `ruff`

Example:
```python
from typing import Optional, List

def fetch_sankey_data(
    system_id: str,
    method_id: Optional[str] = None,
    max_nodes: int = 25
) -> dict:
    """
    Fetch Sankey graph data from openLCA IPC.
    
    Args:
        system_id: Product system ID
        method_id: Impact method ID (optional)
        max_nodes: Maximum number of nodes to include
        
    Returns:
        Dictionary containing nodes and links
    """
    # Implementation
    pass
```

### TypeScript/React (Frontend)

- **Style Guide** – Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- **Type Safety** – Use strict TypeScript, avoid `any`
- **Components** – Use functional components with hooks
- **Naming**:
  - Components: PascalCase (`SankeyDiagram.tsx`)
  - Utilities: camelCase (`formatValue.ts`)
  - Constants: UPPER_SNAKE_CASE
- **Formatting** – Use Prettier (already configured)
- **Linting** – Use ESLint (already configured)

Example:
```typescript
interface SankeyConfig {
  fontSizeTitle: number;
  boxSize: number;
  // ... other properties
}

const SankeyDiagram = forwardRef<SVGSVGElement, SankeyProps>(
  ({ data, width, height, config }, ref) => {
    // Implementation
  }
);
```

### CSS/Styling

- **Tailwind First** – Use TailwindCSS utilities when possible
- **Inline Styles** – For dynamic values or critical layout (React style prop)
- **CSS Modules** – For component-specific styles (if needed)
- **Glass Design Tokens** – Reuse the `G` object in App.tsx for consistent glassmorphism

## 💬 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes
- `ci`: CI/CD changes

### Examples
```bash
feat(frontend): add mouse wheel zoom support

Implement zoom functionality using wheel events.
Caps zoom between 0.1x and 3x for usability.

Closes #42

fix(backend): handle missing impact category gracefully

Previously crashed with KeyError when category was None.
Now returns empty dataset with clear error message.

Fixes #38

docs: update installation instructions for Windows

Add PowerShell-specific commands and troubleshooting section.
```

### Scope Guidelines
- `frontend`: React/TypeScript changes
- `backend`: Python/FastAPI changes
- `ui`: UI/UX improvements
- `api`: API endpoint changes
- `config`: Configuration file changes

## 🔄 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Write clean, documented code
   - Follow coding standards
   - Add tests if applicable

3. **Test thoroughly**
   - Backend: Test API endpoints manually or with `test_api.py`
   - Frontend: Test in browser with different configurations
   - Test with real openLCA data

4. **Commit with conventional commits**
   ```bash
   git add .
   git commit -m "feat(frontend): add export quality selector"
   ```

5. **Push to your fork**
   ```bash
   git push origin feat/your-feature-name
   ```

6. **Open a Pull Request**
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changed and why
   - Include screenshots for UI changes
   - List any breaking changes

7. **Code Review**
   - Address reviewer feedback
   - Keep the PR focused (one feature/fix per PR)
   - Squash commits if requested

8. **Merge**
   - After approval, a maintainer will merge your PR
   - Delete your feature branch after merge

## 🧪 Testing Guidelines

### Backend Testing
```bash
cd backend
python test_api.py
```

Manual testing:
- Start openLCA IPC server
- Start backend
- Test each endpoint with curl or Postman
- Verify error handling with invalid inputs

### Frontend Testing

Manual testing:
- Test all controls and sliders
- Test node dragging and canvas panning
- Test export functionality
- Test responsive behavior (resize window)
- Test with different product systems and methods
- Test error states (disconnect openLCA)
- Test in different browsers (Chrome, Firefox, Edge)

Performance testing:
- Test with large graphs (100+ nodes)
- Monitor memory usage
- Check render performance

### Integration Testing
- Test full workflow from system selection to export
- Test reconnection after openLCA restart
- Test race conditions (rapid method changes)

## 📚 Documentation

When contributing, also update:
- **README.md** – For user-facing features
- **Code comments** – For complex logic
- **JSDoc/docstrings** – For functions and components
- **CHANGELOG.md** – For version releases (maintained by maintainers)

## 🎯 Areas We Need Help

Priority areas for contribution:
- [ ] Unit tests for backend and frontend
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)
- [ ] Mobile responsive design
- [ ] Internationalization (i18n)
- [ ] Performance optimizations for large graphs
- [ ] Alternative export formats (SVG, PDF)
- [ ] Color schemes and themes
- [ ] Documentation translations

## 💡 Questions?

If you have questions:
- **GitHub Discussions** – For general questions
- **GitHub Issues** – For bug reports and feature requests
- **Comments in PR** – For PR-specific questions

## 🙌 Recognition

Contributors will be:
- Listed in README.md acknowledgments
- Credited in release notes
- Given a shoutout on social media (if applicable)

Thank you for contributing to OpenLCA Sankey Plugin! 🎉
