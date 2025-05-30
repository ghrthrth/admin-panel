export interface MenuItem {
  code: string
  label: {
    zh_CN: string
    en_US: string
    ru_RU: string
  }
  icon?: string
  path: string
  children?: MenuItem[]
  affix?: boolean
}

export type MenuChild = Omit<MenuItem, 'children'>

export type MenuList = MenuItem[]
