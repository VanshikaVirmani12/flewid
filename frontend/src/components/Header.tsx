import React from 'react'
import { Layout, Menu, Button, Space } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  HomeOutlined, 
  BuildOutlined, 
  UserOutlined,
  PlusOutlined,
  CloudOutlined
} from '@ant-design/icons'

const { Header: AntHeader } = Layout

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/builder',
      icon: <BuildOutlined />,
      label: 'Workflow Builder',
    },
    {
      key: '/accounts',
      icon: <CloudOutlined />,
      label: 'AWS Accounts',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const handleNewWorkflow = () => {
    navigate('/builder')
  }

  return (
    <AntHeader className="bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <div className="text-xl font-bold text-blue-600 mr-8">
          Flowid
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-none"
        />
      </div>
      
      <Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleNewWorkflow}
        >
          New Workflow
        </Button>
        <Button 
          type="text" 
          icon={<UserOutlined />}
          className="flex items-center"
        >
          Profile
        </Button>
      </Space>
    </AntHeader>
  )
}

export default Header
