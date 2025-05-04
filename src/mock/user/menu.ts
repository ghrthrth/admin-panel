import Mock from 'mockjs'
import response from '../response'
import type { MenuList } from '@/interface/layout/menu.ts'

const getMenuListBasedOnRole = (role: string): MenuList => {
  const baseMenu: MenuList = [
    {
      code: 'dashboard',
      icon: 'dashboard',
      label: {
        zh_CN: '首页',
        en_US: 'Dashboard',
        ru_RU: 'Главная'
      },
      path: '/dashboard',
      affix: true,
    },
    {
      code: 'staff',
      icon: 'dashboard',
      label: {
        zh_CN: '首页',
        en_US: 'staff',
        ru_RU: 'Мед.персонал'
      },
      path: '/api/staff',
    },
    {
      code: 'charts',
      icon: 'charts',
      label: {
        zh_CN: '图表',
        en_US: 'Charts',
        ru_RU: 'Графики'
      },
      path: '/charts',
      children: [
        {
          code: 'bar',
          icon: 'bar-chart',
          label: {
            zh_CN: '柱状图',
            en_US: 'Bar Chart',
            ru_RU: 'Гистограмма'
          },
          path: '/charts/bar',
        },
      ],
    },
    {
      code: 'components',
      icon: 'components',
      label: {
        zh_CN: '组件',
        en_US: 'Components',
        ru_RU: 'Компоненты'
      },
      path: '/components',
      children: [
        {
          code: 'json-editor',
          icon: 'json-editor',
          label: {
            zh_CN: 'JSON 编辑器',
            en_US: 'JSON Editor',
            ru_RU: 'JSON Редактор'
          },
          path: '/components/json-editor',
        },
      ],
    },
    {
      code: 'error-page',
      icon: 'error-page',
      label: {
        zh_CN: '错误页面',
        en_US: 'Error Page',
        ru_RU: 'Ошибка'
      },
      path: '/error',
      children: [
        {
          code: '403',
          icon: '403',
          label: {
            zh_CN: '403',
            en_US: '403',
            ru_RU: '403'
          },
          path: '/error/403',
        },
        {
          code: '404',
          icon: '404',
          label: {
            zh_CN: '404',
            en_US: '404',
            ru_RU: '404'
          },
          path: '/error/404',
        },
      ],
    },
  ];

  if (role === 'doctor' || role === 'nurse') {
    // Заменяем пункт "staff" на "pacients" для врачей и медсестер
    const staffIndex = baseMenu.findIndex(item => item.code === 'staff');
    if (staffIndex !== -1) {
      baseMenu[staffIndex] = {
        code: 'pacients',
        icon: 'dashboard',
        label: {
          zh_CN: '首页',
          en_US: 'Pacients',
          ru_RU: 'Пациенты'
        },
        path: '/pacients',
      };
    }
  }

  return baseMenu;
};

Mock.mock('/api/layout/menu', 'get', (options: any) => {
  const userData = localStorage.getItem('user-info');
  let role = 'guest';

  if (userData) {
    try {
      // Исправлено: получаем роль из вложенного state.userInfo
      const storageData = JSON.parse(userData);
      role = storageData.state?.userInfo?.role || 'guest';
      console.log('Extracted role:', role); // Должно быть "doctor"
    } catch (e) {
      console.error('Parsing error:', e);
    }
  }

  const menuList = getMenuListBasedOnRole(role);
  return response(menuList);
});