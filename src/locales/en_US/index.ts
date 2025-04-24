import { user } from './user'
import { article } from './business/article'
import { tabBar } from './tabBar'
import { staff } from '@/locales/en_US/staff/staff.ts'

const enUS = {
  ...user,
  ...article,
  ...tabBar,
  ...staff,
}

export default enUS
