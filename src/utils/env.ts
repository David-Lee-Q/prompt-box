// 判断是否在 Chrome 扩展环境运行
export function isExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
}

// 是否需要使用代理 fetch（扩展不需要，Web 需要）
export function shouldUseProxy(): boolean {
  return !isExtension();
}
