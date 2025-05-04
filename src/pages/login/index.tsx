import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message, theme } from 'antd';
import { FormattedMessage } from 'react-intl';
import { useLocale } from '@/locales';
import { login } from '@/api/user';
import useUserStore from '@/stores/user';
import type { LoginParams } from '@/interface/user/login';
import './index.scss';

const { useToken } = theme;

// Добавляем initialValues
const initialValues: LoginParams = {
  login: 'admin',
  password: 'admin'
};

const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { setUserInfo } = useUserStore();
  const { formatMessage } = useLocale();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { token } = useToken(); // Добавляем использование токена

  const handleLogin = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // Проверка на статического администратора
      if (values.login === 'admin' && values.password === 'admin123') {
        setUserInfo({
          id: 1,
          name: 'Admin',
          role: 'admin',
          // Добавьте другие необходимые поля
        });

        messageApi.open({
          type: 'success',
          content: 'Вход выполнен успешно!',
          duration: 2,
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        navigate('/', { replace: true });
        return;
      }

      // Обычный вход через API
      const res = await login(values);

      if (res.data?.code === 200) {
        setUserInfo(res.data.result);

        messageApi.open({
          type: 'success',
          content: 'Вход выполнен успешно!',
          duration: 2,
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        navigate('/', { replace: true });
      }
    } catch (error) {
      messageApi.error(error.response?.data?.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ backgroundColor: token.colorBgLayout }}>
      {contextHolder}
      <Form
        style={{ width: 260 }}
        initialValues={initialValues}
        form={form}
        onFinish={handleLogin}
      >
        <h1 className="title">Login</h1>
        <Form.Item
          name="login"
          rules={[
            {
              required: true,
              message: formatMessage({ id: 'user.login.username' }),
            },
          ]}
        >
          <Input placeholder={formatMessage({ id: 'user.login.username' })} />
        </Form.Item>
        <Form.Item
          name="password"
          rules={[
            {
              required: true,
              message: formatMessage({ id: 'user.login.password' }),
            },
          ]}
        >
          <Input.Password placeholder={formatMessage({ id: 'user.login.password' })} />
        </Form.Item>
        <Form.Item>
          <Button
            className="submit-btn"
            htmlType="submit"
            type="primary"
            block
            loading={loading}
          >
            <FormattedMessage id="user.login.button" />
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default Login;