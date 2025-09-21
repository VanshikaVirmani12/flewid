# Copilot Instructions for Flewid AWS Debugging Automation Platform

## Big Picture Architecture
- **Frontend**: React (TypeScript) app in `frontend/` using React Flow for workflow building, Ant Design for UI, Zustand for state, Tailwind for styling, and Socket.io for real-time updates.
- **Backend**: Node.js (TypeScript) API in `backend/` using Express, Socket.io, Bull/Redis for queues, PostgreSQL for data, AWS SDK v3 for cloud integration. Key services: Workflow Engine, AWS Connectors, Execution Manager.
- **Data Layer**: PostgreSQL (workflows, executions, users), Redis (cache/session), AWS S3 (logs/reports).
- **DevOps**: Docker, GitHub Actions, Prometheus/Grafana, ELK for logging.

## Developer Workflows
- **Frontend**:
  - Start dev server: `npm run dev` in `frontend/` (Vite, port 3000, proxies `/api` and `/socket.io` to backend)
  - Build: `npm run build` (TypeScript + Vite)
  - Lint: `npm run lint`
- **Backend**:
  - Start dev server: `npm run dev` in `backend/` (nodemon, port 5000)
  - Build: `npm run build` (TypeScript)
  - Test: `npm run test` (Jest)
  - Lint: `npm run lint`

## Project-Specific Patterns & Conventions
- **Workflow Nodes**: Each AWS service node (e.g., CloudWatchNode) follows a pattern: receives config/inputs, executes service action, outputs results for chaining. See `frontend/src/components/nodes/` for examples.
- **Workflow Data Model**: Nodes and edges use the `WorkflowNode`/`WorkflowEdge` interfaces (see ARCHITECTURE.md for schema).
- **Execution Engine**: Backend parses workflow DAG, executes nodes in topological order, supports parallel execution, aggregates results/errors.
- **Real-Time Updates**: WebSocket (Socket.io) for execution progress/logs between backend and frontend.
- **API Proxying**: Frontend proxies `/api` and `/socket.io` to backend (see `vite.config.ts`).
- **Credential Management**: AWS credentials handled via IAM roles and temporary tokens; never hardcode secrets.
- **Error Handling**: Nodes and engine aggregate errors, support retries, and surface issues to UI.

## Integration Points
- **AWS SDK v3**: Used in backend for all AWS service calls (CloudWatch, DynamoDB, S3, Lambda, etc.).
- **Socket.io**: Used for real-time communication (execution status, logs).
- **Bull/Redis**: Used for queueing workflow executions and async tasks.
- **PostgreSQL**: Stores workflow definitions, execution history, user data.
- **Frontend/Backend Communication**: REST and WebSocket endpoints, proxied via Vite config.

## Key Files & Directories
- `ARCHITECTURE.md`: System overview, data models, and workflow patterns.
- `frontend/src/components/nodes/`: AWS service node implementations (CloudWatchNode, etc.).
- `backend/`: API, workflow engine, AWS connectors, queue management.
- `frontend/vite.config.ts`: Dev server config and proxy rules.
- `frontend/package.json` / `backend/package.json`: Scripts and dependencies.

## Example: Adding a New AWS Node
1. Create a new node component in `frontend/src/components/nodes/` following the `WorkflowNode` pattern.
2. Implement corresponding backend logic for the AWS service in `backend/src/services/` or similar.
3. Update workflow engine to support new node type if needed.
4. Test end-to-end: drag node in UI, configure, execute, verify results/logs.

---

If any section is unclear or missing, please specify which part needs more detail or examples.