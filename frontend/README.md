# Family Tree Generator

A modern, interactive family tree generator built with Next.js 14. Create, visualize, and share your family history with an intuitive drag-and-drop interface.

![Family Tree Generator](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat-square&logo=tailwind-css)

## ✨ Features

- **Interactive Tree Editor** - Drag-and-drop interface to create and organize family members
- **Multiple Views** - Switch between Standard and Fancy tree visualizations
- **Multi-Spouse Support** - Handle complex family structures with multiple marriages
- **Auto-Align** - Automatically organize your tree in a pyramid layout
- **Export Options** - Export your family tree as PNG or PDF
- **Import/Export JSON** - Save and load your family tree data
- **Responsive Design** - Works on desktop and tablet devices
- **Contact Form** - Built-in SMTP contact functionality

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/AHILL-0121/family-tree-generator.git
   cd family-tree-generator/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file for SMTP (optional):
   ```bash
   cp .env.example .env.local
   ```
   
   Then edit `.env.local` with your SMTP credentials:
   ```
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **Tree Visualization**: Topola library
- **Email**: Nodemailer
- **Icons**: Lucide React

## 📁 Project Structure

```
frontend/
├── app/
│   ├── api/contact/      # Contact form API route
│   ├── editor/           # Tree editor page
│   ├── page.tsx          # Landing page
│   └── layout.tsx        # Root layout
├── components/
│   ├── ui/               # Shadcn UI components
│   ├── TreeCanvas.tsx    # Main tree canvas
│   ├── FancyTreeView.tsx # Topola-based fancy view
│   ├── PersonForm.tsx    # Add/edit person form
│   ├── PersonList.tsx    # Family members list
│   └── ContactForm.tsx   # Contact form component
├── lib/
│   ├── types.ts          # TypeScript types
│   ├── tree-layout.ts    # Tree layout algorithms
│   └── utils.ts          # Utility functions
└── hooks/                # Custom React hooks
```

## 📝 Usage

1. **Add Family Members**: Double-click on the canvas to add your first person
2. **Edit Person**: Double-click on any node to edit details or add relatives
3. **Add Relatives**: Use the form buttons to add parents, children, spouses, or siblings
4. **Drag & Drop**: Move nodes around to customize your layout
5. **Auto-Align**: Click "Auto Align" to organize the tree automatically
6. **Switch Views**: Toggle between Standard and Fancy views
7. **Export**: Use the export button in Fancy view to save as PNG/PDF
8. **Save Data**: Export your tree as JSON to save your work

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👨‍💻 Developer

Created by [AHILL-0121](https://github.com/AHILL-0121)

---

Made with ❤️ for families everywhere
