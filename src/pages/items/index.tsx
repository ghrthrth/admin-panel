import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Card, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import './index.scss'; // Импорт SCSS стилей

const { Title } = Typography;

interface Item {
  id: number;
  name: string;
  description?: string;
  createdAt?: string;
}

const API_URL = 'http://localhost:8001/api/items';

const ItemsPage = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL);
      setItems(response.data);
    } catch (err) {
      message.error('Failed to fetch items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: Item) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
      message.success('Item deleted successfully');
      fetchItems();
    } catch (err) {
      message.error('Failed to delete item');
      console.error(err);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingItem) {
        await axios.put(`${API_URL}/${editingItem.id}`, values);
        message.success('Item updated successfully');
      } else {
        await axios.post(API_URL, values);
        message.success('Item added successfully');
      }

      setIsModalVisible(false);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a: Item, b: Item) => a.id - b.id,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Item, b: Item) => a.name.localeCompare(b.name),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || 'N/A',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
      sorter: (a: Item, b: Item) =>
        new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Item) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Are you sure to delete this item?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="items-page-container"> {/* Добавляем класс контейнера */}
      <Card>
        <div className="page-header">
          <Title level={3}>Items Management</Title>
          <Space>
            <Input
              placeholder="Search items"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              Add Item
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content', y: 'calc(100vh - 250px)' }}
        />

        <Modal
          title={editingItem ? 'Edit Item' : 'Add New Item'}
          open={isModalVisible}
          onOk={handleSubmit}
          onCancel={() => setIsModalVisible(false)}
          destroyOnClose
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Please input item name!' }]}
            >
              <Input placeholder="Item name" />
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
            >
              <Input.TextArea rows={4} placeholder="Item description" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default ItemsPage;