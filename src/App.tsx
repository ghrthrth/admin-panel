import { Suspense } from 'react'
import { HashRouter } from 'react-router-dom'
import { Spin, ConfigProvider, theme as antTheme } from 'antd'
import { IntlProvider } from 'react-intl'
import enUS from 'antd/es/locale/en_US'
import zhCN from 'antd/es/locale/zh_CN'
import ruRU from 'antd/locale/ru_RU'
import { localeConfig } from './locales'
import RenderRouter from './routes'
import RouteGuard from './routes/permission'
import useAppStore from './stores/app'

function App() {
  const { theme, locale, loading } = useAppStore()

  const getAntdLocale = () => {
    if (locale === 'zh_CN') {
      return zhCN
    } else if (locale === 'en_US') {
      return enUS
    }
    else if (locale === 'ru_RU'){
      return ruRU
    }
  }

  return (
    <ConfigProvider
      locale={getAntdLocale()}
      theme={{
        algorithm: theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      }}
    >
      <IntlProvider locale={locale.split('_')[0]} messages={localeConfig[locale]}>
        <HashRouter>
          <Suspense fallback={null}>
            <Spin
              className="app-loading-wrapper"
              spinning={loading}
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.44)' : 'rgba(255, 255, 255, 0.44)',
              }}
            ></Spin>
            <RouteGuard>
              <RenderRouter />
            </RouteGuard>
          </Suspense>
        </HashRouter>
      </IntlProvider>
    </ConfigProvider>
  )
}

export default App
