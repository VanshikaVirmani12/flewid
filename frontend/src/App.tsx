import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import WorkflowBuilder from './components/WorkflowBuilder'
import Dashboard from './components/Dashboard'
import AWSAccountManager from './components/AWSAccountManager'
import Header from './components/Header'

const { Content } = Layout

function App() {
  return (
    <Layout className="min-h-screen">
      <Header />
      <Content>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/builder" element={<WorkflowBuilder />} />
          <Route path="/builder/:id" element={<WorkflowBuilder />} />
          <Route path="/accounts" element={<AWSAccountManager />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
