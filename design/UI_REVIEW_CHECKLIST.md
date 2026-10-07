# UI review checklist

Use this for every screen concept and every built screen. Answer each line honestly.
If **3 or more** lines fail, redesign before implementation.

## A. Generic / AI look
1. Does this look like a generic SaaS dashboard?
2. Does it look AI-generated?
3. Too many cards? (Count them. More than 4 bordered objects in one view needs a reason.)
4. Too many rounded surfaces? (Radius only from the DNA radius table.)
5. Gradients used unnecessarily? (Default answer: there should be none.)
6. Are decorative elements actually useful?
7. Are animations meaningful? (Each one names the state change it shows.)
8. Could this screenshot be confused with another AI-generated SaaS dashboard?

## B. Craft
9. Is typography doing enough work? (Clear sizes from the DNA scale; no all-caps labels.)
10. Is the information hierarchy obvious in 3 seconds? (What is the one thing to look at first?)
11. Premium without visual noise?
12. Is information density right for this module?
13. Does it still look good with all decoration removed?
14. Does every component have a purpose? (One home per action; no number shown twice.)

## C. Identity and consistency
15. Is the composition right for this module? (See the module table in `DESIGN_DNA.md` / brief.)
16. Is there a recognisable identity? (Clear order, plain words, one list for what needs you, consistent blocks.)
17. Is it consistent with the approved Design DNA? (Tokens, radius, borders, buttons, tables.)
18. Does it feel like a mature enterprise product?

## C2. User needs and clarity
19. Are the users of this screen and their top jobs written down?
20. Does the top of the screen answer "what needs me" and "what can I do"?
21. Is each number shown in one place only?
22. Does every item have one clear next action, named with a verb?
23. Are labels plain words a new employee understands?
24. Are loading, empty and error states designed for every block?
25. Does the phone order match the task order (not just a squeezed desktop)?

## C3. Usability and accessibility (WCAG 2.2 AA)
- [ ] Text contrast ≥ 4.5:1 (large text ≥ 3:1) in light **and** dark.
- [ ] Controls and focus ring ≥ 3:1 against the background.
- [ ] Focus ring visible on every control (3 px, 2 px gap).
- [ ] Keyboard: Tab order = visual order; Esc closes; arrow keys in tabs; focus returns after dialogs.
- [ ] Targets: 40 px desktop, ≥ 44 px phone (never under 24 px).
- [ ] Status never by colour alone (icon + word).
- [ ] Links are underlined or otherwise not colour-only.
- [ ] Screen reader: landmarks, one h1, h2 per block, buttons name their object, live region for toasts, aria-busy while loading, role=alert for errors.
- [ ] Body text ≥ 15 px (16 px phone); nothing under 13 px.
- [ ] Works at 200% text size and 320 px width without sideways page scroll.
- [ ] Nothing moves on its own for more than 5 s without a pause control.
- [ ] Reduce motion / Off removes all animation.

## D. Must-pass technical checks
- [ ] Light and dark both checked.
- [ ] Lively, Calm and Off (reduce motion) all checked.
- [ ] Phone width (390 px) checked; no sideways scroll.
- [ ] Status never shown by colour alone.
- [ ] Contrast ≥ 4.5:1 for text.
- [ ] Works with a different company primary colour (try a red and a blue).
- [ ] Same information and actions as before (or a listed, approved change).
- [ ] No backend, route, permission or validation change.

## E. Review scores (out of 10)
| Area | Score | Note |
|---|---|---|
| Clarity | | |
| Usability | | |
| Accessibility | | |
| Visual identity | | |
| Premium feel | | |
| Enterprise quality | | |
| Information hierarchy | | |
| Distinctiveness | | |
| AI-generated feel (lower is better) | | |
| Visual noise (lower is better) | | |
| Consistency | | |
| Motion quality | | |
