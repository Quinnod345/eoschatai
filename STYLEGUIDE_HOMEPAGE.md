# 🚀 EOS Homepage Style Guide (Motion-First)

> **Purpose** – Provide copy-paste snippets and utility references for a high-impact landing page that uses EOS mesh gradients, liquid glass, animated accents, and motion-forward interactions.

---

## 🎨 Colors & Brand Tokens

| Token | Light | Dark | Tailwind Utility |
|-------|-------|------|------------------|
| EOS Orange | `#ff7600` | `#ff7600` | `text-eos-orange`, `bg-eos-orange` |
| EOS Navy   | `#002e5d` | `#002e5d` | `text-eos-navy`, `bg-eos-navy` |
| Orange Light | `#ff9033` | — | `bg-eos-orangeLight` |
| Navy Light   | `#1e4d7b` | — | `bg-eos-navyLight` |
| **HSL tokens** | `--primary`, `--muted`, `--border`, … | switch automatically via `.dark` |

```tsx
<button className="bg-eos-orange hover:bg-eos-orange/90 text-white rounded-full px-5 py-2 shadow-glow">
  Start Free Trial
</button>
```

---

## 🔠 Typography

* **Font family** – `var(--font-geist)` via `font-sans`
* **Headline tracking** – `tracking-tight`

```tsx
<h1 className="text-4xl md:text-6xl font-bold tracking-tight">
  Transform Your <span className="gradient-text">EOS</span> Implementation
</h1>
```

---

## 🌈 Gradients & Mesh

### Animated Gradient Text

```html
<span class="gradient-text">AI-Powered</span>
```

### Mesh Background Wrappers

```html
<div class="eos-app-mesh relative min-h-screen">
  <div class="noise-texture pointer-events-none absolute inset-0 opacity-20"></div>
  <!-- content here -->
</div>
```

```html
<section class="relative overflow-hidden eos-flow-bg">
  <div class="container mx-auto px-6 py-20 relative z-10">…</div>
</section>
```

---

## 🧊 Glassmorphism Utilities

| Class | Purpose |
|-------|---------|
| `glass-morphism` | Generic blurred surface |
| `eos-glass`      | Higher-level glass card/button |
| `glass-card`     | Pre-styled rounded card |
| `glass-button`   | Translucent button shell |

```tsx
<div className="glass-card p-6">
  <h3 className="text-xl font-semibold mb-2">Interactive Composer</h3>
  <p className="text-sm text-muted-foreground">Code, charts, docs, and sheets—created and edited with AI.</p>
</div>
```

---

## ✨ Shadows & Glow

* **Primary CTA / Hover** – `shadow-glow` / `shadow-glow-sm`
* **Cards / Stats**        – `depth-shadow`

```tsx
<button className="eos-button bg-eos-orange text-white shadow-glow">
  Get Started
</button>
```

---

## ⚡ Motion Utilities (Motion-First)

Landing pages thrive on kinetic energy; the following classes add purposeful movement:

| Utility | Effect |
|---------|--------|
| `animate-float` / `animate-float-delayed` | Gentle oscillation for floating UI bits |
| `eos-rotating-gradient` | Slow gradient rotation |
| `hover-scale` / `hover-lift` | Spring-like hover transform |
| `hover-glow` | Adds emissive glow on hover |
| `eos-float` / `eos-float-sideways` | Continuous blob drift |
| `eos-breathe` | Subtle scale pulse |

All motion utilities are enabled by default; no reduced-motion fallbacks are injected on the homepage to keep the experience lively.

---

## 🏗️ Section & Layout Patterns

### Hero (mesh + blobs)

```tsx
<section className="relative py-24 eos-app-mesh overflow-hidden">
  <div className="noise-texture pointer-events-none absolute inset-0 opacity-20" />
  <div className="pointer-events-none absolute -top-24 -left-16 w-[36rem] h-[36rem] rounded-full blur-3xl bg-eos-orange/10" />
  <div className="pointer-events-none absolute -bottom-24 -right-16 w-[42rem] h-[42rem] rounded-full blur-3xl bg-eos-navy/10" />

  <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
    <div>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-morphism text-eos-orange text-sm font-medium shadow-glow-sm">
        Advanced EOS AI Platform
      </div>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight mt-6">
        Transform Your EOS with <span className="gradient-text">AI</span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-xl mt-4">
        Streaming chat, composer, document intelligence, deep research, and voice.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <a href="/register"><button className="eos-button bg-eos-orange hover:bg-eos-orange/90 text-white shadow-glow">Start Free Trial</button></a>
        <a href="/features"><button className="glass-button">Explore Features</button></a>
      </div>
    </div>
    <div className="relative">
      <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-border/50 glass-morphism-dark bg-muted/50" />
    </div>
  </div>
</section>
```

### Feature Band Template

```tsx
<section className="py-20 md:py-28 bg-gradient-to-b from-muted/30 to-background">
  <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center">
    <div>
      <h3 className="text-3xl font-bold mb-3">Advanced Search</h3>
      <p className="text-muted-foreground mb-6">Global search with filters and relevance scoring.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-morphism rounded-xl p-4 text-sm">Smart Filters</div>
        <div className="glass-morphism rounded-xl p-4 text-sm">Relevance</div>
      </div>
    </div>
    <div className="relative">
      <div className="rounded-2xl overflow-hidden border border-border/50 glass-morphism-dark aspect-[4/3]" />
    </div>
  </div>
</section>
```

---

## 📑 Utility Cheat-Sheet

```
Mesh:          eos-app-mesh  •  eos-flow-bg  •  noise-texture
Text:          gradient-text •  tracking-tight • text-muted-foreground
Glass:         glass-morphism •  eos-glass •  glass-card • glass-button
Shadow/Glow:   shadow-glow • shadow-glow-sm • depth-shadow
Motion:        animate-float • eos-rotating-gradient • hover-lift • eos-breathe
Spacing:       py-20 md:py-28 • container mx-auto px-6 • grid lg:grid-cols-2 gap-10
```

> **Tip** – Compose sections with generous vertical rhythm. Use animated blobs only where they frame—not block—content.

