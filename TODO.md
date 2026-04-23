# POA Director Notifications & Confirmation Dialog - Implementation TODO

## Approved Plan Summary
- Replace DocumentosPOAPage revision modal → simple confirmation dialog (exact text).
- Add pending director review count API endpoint.
- Dots/badges: ModuleSelector POA card, POA Sidebar "Documentos POA"/"Revisión POA".
- Director instruction text in review cards.
- Client fetches counts on login/module/sidebar entry.

Current progress: 0/8 steps complete.

## Breakdown Steps (Execute Sequentially)

### Backend Changes
1. **[x]** `backend/poa_document/api/views.py`: Add `@action(detail=False)` `pending_director_reviews` → count pending director reviews per user carrera/gestion.
2. **[x]** Update `enviar_revision` → auto-director only (simplify, ignore entities).
3. **[x]** `frontend/src/apis/poa.api.js`: Add `getPendingDirectorReviews(gestion)`.

### Frontend Changes - Core
4. **[x]** `frontend/src/modules/poa/pages/DocumentosPOAPage.jsx`: 
   - New `showConfirmModal`/`confirmDoc` states.
   - Confirmation dialog (exact text, Yes→enviarRevision, No→close).
   - Director cards: Add instruction text (review + approve/observe).
5. **[x]** Test dialog flow (no modal, auto-director backend).

### Frontend - Notifications
6. **[x]** `frontend/src/components/ModuleSelector.jsx`: `pendingPOA` state/useEffect → red badge/dot on POA card if >0.
7. **[x]** `frontend/src/modules/poa/components/Sidebar.jsx`: Props `pendingReviews` → dot on "Documentos POA"/"Revisión POA".
8. **[x]** `frontend/src/modules/poa/poa_App.jsx`: Compute `pendingReviews` state → pass to Sidebar.

**All implementation steps complete! Next: Post-implementation tests.**

Current progress: 8/8 steps complete.

## Post-Implementation
- [ ] Test: Login as director → POA module badge/dot in selector, sidebar dots, send doc → confirm dialog (no complex modal), review/approve → badges disappear.
- [ ] Backend server running? Test endpoint: open browser `http://127.0.0.1:8000/api/poa/documentos_poa/pending_director_reviews/?gestion=2024`
- [ ] Frontend: `npm run dev` → test full flow.




## Post-Implementation
- [ ] Test: Director login → dots appear/disappear on review.
- [ ] `attempt_completion`: "POA notifications & dialog implemented. Run `npm run dev` & login as director." 

**Next: DocumentosPOAPage dialog → Step 4.**

Current progress: 3/8 steps complete.


