import Mock from 'mockjs'
import response from '../response'
import type { MenuList } from '../../interface/layout/menu'

const menuList: MenuList = [
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
]

Mock.mock('/api/layout/menu', 'get', () => {
  return response(menuList)
})