# OpenLCA Sankey Plugin

A modern, interactive Sankey diagram visualization plugin for [openLCA](https://www.openlca.org/) 2.6.0 that transforms default diagrams into **publication-ready, presentation-quality visualizations**. Solves text truncation, font visibility, and export quality issues while preserving exact openLCA data calculations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![React](https://img.shields.io/badge/react-19.2-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)

## 🎯 Why This Plugin?

The default openLCA Sankey diagram has significant **presentation limitations** that make it unsuitable for professional publications, websites, and presentations:

### Problems with Default Sankey
- ❌ **Text Truncation** – Process names and flow names get cut off with "..." making diagrams incomplete
- ❌ **Poor Font Visibility** – Small, fixed font sizes are difficult to read, especially in exports
- ❌ **Limited Customization** – No control over box sizes, spacing, or layout proportions
- ❌ **Export Quality Issues** – Low-resolution exports with inconsistent colors and poor scaling
- ❌ **Not Publication-Ready** – Diagrams require extensive post-processing in graphic design tools
- ❌ **Static Layout** – Cannot reposition nodes or adjust spacing for clarity

### ✅ How This Plugin Solves These Issues

This plugin **enhances presentation quality** while preserving the exact same data from openLCA:

- ✅ **Smart Text Wrapping** – Automatically wraps long names across multiple lines, no truncation
- ✅ **Adjustable Typography** – 4 independent font size controls for optimal readability
- ✅ **Full Layout Control** – Customize box dimensions, spacing, and content ratios
- ✅ **Publication-Quality Exports** – High-resolution PNG (4× pixel ratio) with perfect color matching
- ✅ **Interactive Editing** – Drag nodes to reposition, pan/zoom for exploration
- ✅ **Professional Aesthetics** – Modern liquid glass UI suitable for presentations and websites

**The data remains identical to openLCA's native calculations** – this plugin simply makes your Sankey diagrams **presentation-ready** without manual editing.

## ✨ Features

### Core Functionality
- **Native OpenLCA 2.6.0 Integration** – Uses the official `get_sankey_graph()` API for accurate, up-to-date visualizations
- **Interactive Sankey Diagrams** – Drag nodes to reposition, pan and zoom the canvas
- **Multiple Orientations** – Top-down, bottom-up, left-right, right-left layouts
- **Real-time Calculations** – Computes direct and upstream impacts with contribution percentages

### Advanced Customization
- **4 Independent Font Size Controls** – Separate sizing for title, flow name, direct values, and upstream values
- **Flexible Box Sizing** – Independent width (150-500px) and height (60-300px) controls
- **Layer Gap Control** – Adjust spacing between node layers (10-300px)
- **Partition Ratios** – Customize header size and direct/upstream content split
- **Connection Styles** – Choose between curved or straight links
- **Link Opacity** – Adjust transparency for better visibility
- **Theme Support** – Light and dark themes

### Premium UI/UX
- **Liquid Glass Sidebar** – Apple-style frosted glass design with `backdrop-filter` blur and saturation
- **Collapsible Settings Panel** – Hide/show controls with smooth animations
- **Grouped Controls** – Organized sections for fonts and layout parameters
- **Precision Sliders** – Real-time value display with tabular numerics
- **Responsive Design** – Full viewport layout with proper ResizeObserver integration

### Export & Quality
- **High-Resolution PNG Export** – 4× pixel ratio for crisp exports
- **Tight Bounding Box** – Exports only the diagram content, no whitespace
- **Color-Accurate Rendering** – Pure SVG text rendering ensures export matches screen colors
- **No Truncation** – Text wraps intelligently without cutting off content

## 🚀 Quick Start

### Prerequisites
- **openLCA 2.6.0** with IPC server enabled (port 8080)
- **Python 3.9+**
- **Node.js 18+** and npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ankur-paan/openlca-sankey-plugin.git
   cd openlca-sankey-plugin
   ```

2. **Install Python dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

#### 1. Start openLCA IPC Server
In openLCA 2.6.0:
- Go to **Tools → Developer tools → IPC server**
- Set port to `8080`
- Click **Start**

#### 2. Start the Backend (FastAPI)
```bash
cd backend
python main.py
```
The backend API will be available at `http://localhost:8000`

#### 3. Start the Frontend (Vite + React)
```bash
cd frontend
npm run dev
```
The frontend will be available at `http://localhost:5173`

Alternatively, use the provided batch script:
```bash
start.bat
```

## 📖 Usage

### Basic Workflow
1. **Select Product System** – Choose from available product systems in openLCA
2. **Select Impact Method** – Choose an impact assessment method
3. **Select Impact Category** – Categories are loaded dynamically based on the selected method
4. **Adjust Parameters** – Customize min contribution share, max processes, layout, fonts, etc.
5. **Interact** – Drag nodes to reposition, pan/zoom the canvas
6. **Export** – Click "Export PNG" for high-resolution output

### Keyboard & Mouse Controls
- **Drag nodes** – Click and drag any node to reposition it
- **Pan canvas** – Click and drag on empty space
- **Zoom** – Mouse wheel (future enhancement)
- **Toggle sidebar** – Click the menu/close button in the top-left corner

## 🏗️ Architecture

### Tech Stack

#### Backend
- **FastAPI** – Modern Python web framework
- **olca-ipc 2.4.0** – Official openLCA IPC client library
- **olca-schema 2.4.0** – OpenLCA data schemas
- **CORS middleware** – Enables cross-origin requests from frontend

#### Frontend
- **React 19.2** – UI library
- **TypeScript 5.x** – Type-safe JavaScript
- **Vite** – Fast build tool and dev server
- **TailwindCSS 4.1** – Utility-first CSS framework (with PostCSS plugin)
- **Axios** – HTTP client
- **html-to-image** – PNG export functionality
- **file-saver** – Download export files

### Project Structure
```
openlca-sankey-plugin/
├── backend/
│   ├── main.py              # FastAPI server, IPC integration
│   ├── requirements.txt     # Python dependencies
│   ├── test_api.py          # API endpoint tests
│   └── debug_ipc.py         # IPC connection debugging
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main application with liquid glass sidebar
│   │   ├── main.tsx         # React entry point
│   │   ├── index.css        # Global styles (Tailwind v4)
│   │   ├── App.css          # Root element styles
│   │   └── components/
│   │       └── SankeyDiagram.tsx  # SVG-based Sankey renderer
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── start.bat                # Windows batch script to start both servers
```

## 🔧 Configuration

### Backend API Endpoints
- `GET /api/status` – Check openLCA connection status
- `GET /api/descriptors/{type}` – List available descriptors (ProductSystem, ImpactMethod)
- `GET /api/method/{method_id}/categories` – Get impact categories for a method
- `GET /api/sankey/{system_id}` – Generate Sankey graph data

### Query Parameters
- `impact_method_id` – Impact assessment method ID
- `impact_category_id` – Impact category ID
- `max_nodes` – Maximum number of processes (default: 25)
- `min_share` – Minimum contribution share threshold (default: 0)

## 🎨 Design Philosophy

This plugin follows modern UI/UX best practices:

1. **Glassmorphism** – Frosted glass effect with `backdrop-filter: blur(40px) saturate(200%)`
2. **Progressive Enhancement** – Works without Tailwind classes (uses inline styles for critical layout)
3. **Accessibility** – Proper focus states, ARIA labels, keyboard navigation support planned
4. **Performance** – ResizeObserver for dimension tracking, useMemo for expensive computations
5. **Type Safety** – Comprehensive TypeScript interfaces throughout

## 🐛 Known Issues & Limitations

- No undo/redo for node repositioning
- Export doesn't preserve custom node positions (exports layout at identity transform)
- Single-node graphs show a minimal placeholder

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (backend and frontend)
5. Commit using conventional commits (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [openLCA](https://www.openlca.org/) team for the excellent LCA software and IPC API
- [GreenDelta](https://www.greendelta.com/) for maintaining olca-ipc and olca-schema Python packages
- The React, Vite, and TailwindCSS communities

## 📧 Contact & Support

- **Issues** – Please use the [GitHub Issues](https://github.com/ankur-paan/openlca-sankey-plugin/issues) tracker
- **Discussions** – Join [GitHub Discussions](https://github.com/ankur-paan/openlca-sankey-plugin/discussions)

## 🗺️ Roadmap

- [ ] Mouse wheel zoom support
- [ ] Undo/redo for node positioning
- [ ] Save/load custom layouts
- [ ] Export custom layouts
- [ ] Color coding by impact contribution
- [ ] Advanced filtering options
- [ ] Multi-language support
- [ ] Keyboard shortcuts overlay
- [ ] Dark mode enhancements
- [ ] Mobile-responsive layout

---

**Made with ❤️ for the openLCA community**
