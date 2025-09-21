# Flowid - AWS Debugging Automation Platform

A drag-and-drop, flowchart-based automation platform that helps developers and DevOps engineers automate repetitive AWS debugging workflows by stitching together logs, database records, and object storage across multiple AWS services.

## 🚀 Features

- **Visual Workflow Builder**: Drag-and-drop interface using React Flow for creating debugging workflows
- **AWS Service Integration**: Built-in nodes for CloudWatch, DynamoDB, S3, Lambda, and more
- **Real-time Execution**: Live workflow execution with progress tracking and results
- **Reusable Playbooks**: Save and share common debugging workflows across teams
- **Cross-service Context Stitching**: Automatically combine outputs from multiple AWS services
- **Developer-first UX**: Simple, intuitive interface designed for debugging workflows

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **React Flow** for the visual workflow builder
- **Ant Design** for UI components
- **Zustand** for state management
- **Vite** for fast development and building
- **Tailwind CSS** for styling

### Backend
- **Node.js** with TypeScript
- **Express.js** for the REST API
- **Socket.io** for real-time updates
- **AWS SDK v3** for AWS service integration
- **Winston** for logging
- **Bull Queue** for background job processing

### Key Components

1. **Workflow Builder**: Visual drag-and-drop interface for creating workflows
2. **Execution Engine**: Processes workflows and executes AWS service calls
3. **AWS Connectors**: Service-specific implementations for each AWS service
4. **Real-time Updates**: WebSocket-based progress tracking
5. **Result Aggregation**: Combines and formats outputs from multiple services

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- AWS credentials configured (for AWS service integration)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flowid
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Configuration**
   
   Create `.env` files in both frontend and backend directories:
   
   **Backend (.env)**:
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   AWS_REGION=us-east-1
   LOG_LEVEL=info
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

## 📖 Usage

### Creating Your First Workflow

1. **Open the Workflow Builder**: Navigate to `/builder` in the application
2. **Add Nodes**: Drag AWS service nodes from the sidebar to the canvas
3. **Connect Nodes**: Draw connections between nodes to define the flow
4. **Configure Nodes**: Click on nodes to configure their settings
5. **Save & Execute**: Save your workflow and click execute to run it

### Example Use Cases

#### Lambda Error Investigation
```
Start → CloudWatch Logs → DynamoDB Query → S3 Object Fetch → Results
```
- Query CloudWatch for Lambda errors
- Look up related records in DynamoDB
- Fetch relevant S3 objects for context
- Aggregate all information for debugging

#### API Gateway Debug Flow
```
Start → CloudWatch Logs → Lambda Invoke → Condition → Results
```
- Query API Gateway logs for specific request ID
- Invoke related Lambda function for testing
- Conditional branching based on response
- Format and display debugging information

## 🔧 Available AWS Service Nodes

### CloudWatch
- Query logs by request ID, time range, or filters
- Retrieve metrics and alarms
- Export log insights queries

### DynamoDB
- Query/Scan operations
- Get item by key
- Batch operations

### S3
- List objects with filters
- Get object content
- Generate presigned URLs

### Lambda
- Invoke functions
- Get function logs
- Retrieve configuration

### Logic Nodes
- **Condition**: Conditional branching based on data
- **Transform**: Data transformation and formatting

## 🚀 Development

### Project Structure
```
flowid/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── nodes/         # Custom React Flow nodes
│   │   └── ...
├── backend/           # Node.js backend API
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── engines/       # Workflow execution
│   │   └── ...
└── package.json       # Root package.json
```

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run dev:frontend` - Start only the frontend development server
- `npm run dev:backend` - Start only the backend development server
- `npm run install:all` - Install dependencies for all packages

### Adding New AWS Service Nodes

1. **Create the Node Component** (`frontend/src/components/nodes/`)
2. **Add Service Logic** (`backend/src/services/`)
3. **Register the Node Type** in the workflow builder
4. **Add API Endpoints** for the service operations

## 🔒 Security Considerations

- AWS credentials should be configured using IAM roles or environment variables
- API endpoints include rate limiting and input validation
- All user inputs are sanitized before processing
- Audit logging for all workflow executions

## 📊 Monitoring & Logging

- Comprehensive logging using Winston
- Real-time execution tracking via WebSocket
- Error reporting and debugging information
- Performance metrics and execution statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

**Flowid** - Streamlining AWS debugging workflows, one node at a time.
