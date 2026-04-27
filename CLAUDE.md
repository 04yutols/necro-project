1. Project Overview
Name: Necromance Brave (ネクロマンスブレイブ)

Genre: High-End Hack and Slash RPG

Target Platform: Smartphone (Vertical UI)

Core Concept: 勇者の力と魔王の力を併せ持つ少年が、死霊術（ネクロマンス）を駆使して深淵を蹂躙するダークファンタジー。

Inspiration: - System: Knight & Dragon (Speed/Simplicity)

Strategy/VFX: Honkai: Star Rail (Turn-based strategy, Soul Fracture, Interruption)

World/Atmosphere: Genshin Impact (Immersive UI, Lore-rich visuals)

2. Tech Stack
Frontend: Next.js (App Router), Tailwind CSS

Graphics: PixiJS (Combat VFX, Map interaction, Residue rendering)

State Management: React Context or Zustand (Global State for Party/Inventory)

Database: PostgreSQL (via Prisma or Supabase)

Animations: Framer Motion + PixiJS Tweens

3. UI/UX Principles (Gothic-Morphism)
Visuals: - Base: Obsidian (Dark glass), Aged Parchment, Bone frames.

Key Color: Void Purple (#8A2BE2) - Use for magic, glows, and high-rarity highlights.

UX Strategy:

Tab-Based Navigation: Separate "Equip" and "Enhance" screens to ensure high visibility and large assets.

Tactile Feedback: Trigger Haptic API/Vibration on critical hits, enhancement success, and Demonization.

Simplicity: Use direct verbs for actions: 「装備 (Equip)」「強化 (Enhance)」「攻撃 (Attack)」「術 (Skill)」「魔神化 (Demonization)」。

4. Feature Specifications
A. Battle System (High-End Turn-Based)
Layout: 3-tier vertical (Timeline-top / Viewport-middle / Commands-bottom).

View: 2.5D Quarter-view using PixiJS.

Soul Fracture: Enemies have a "Toughness" bar. Breaking it causes a "Fracture" state (Stun + Dmg Amp).

Demonization: An "Ultimate" state that can interrupt the turn order when the Soul Gauge is MAX.

Commands: 4-way Ring Menu (Attack, Skill, Demonization, Item).

B. Necro-Lab: Residue of the Abyss (深淵の残滓)
System: Residue management using a 2-tab system.

Equip Tab: - Display 3 equipment slots prominently.

Show high-detail 3D/Animated visual of the selected Residue.

Inventory grid with large icons.

Enhance Tab:

Focus on Stat growth preview (Before -> After).

Material selection with "Auto-select" feature.

Visual: PixiJS "Soul Chain" effect during infusion.

C. Map System
Background: Clean, hand-drawn ancient codex style (No pre-rendered text).

Interactive Layer: PixiJS layer for stage nodes (1-1, 1-2), lock icons, and magic fog effects.

Sortie Popup: Simple overview (Cost/Units) with a sub-panel for "Intel" (Enemy/Drops).

5. Coding Rules
Performance: Maintain 60fps in PixiJS layers. Use Virtual Scrolling for large inventories.

Responsiveness: All UIs must fit h-[100dvh] without overlapping critical info.

Scalability: Keep game logic (damage calcs, state changes) separate from UI components.

YOLO Mode: Be proactive in suggesting stylish VFX or UX improvements that align with "Star Rail / Genshin" quality.

6. Current Goals
Implement the Tab-Based Residue Management System (Equip/Enhance).

Integrate the 3-Slot Residue Logic into the Battle Engine.

Polish the Demonization Transition VFX.