import { useCallback, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Download,
  Globe,
} from 'lucide-react'
import Logo from '@/components/logo'
import { Footer } from '@/components/Footer'
import { toast } from 'sonner'
import type { DataSourceMode, FetchProgress } from '@/lib/converters'
import {
  Platform,
  converters,
  fetchMemosFromApi,
  getConverter,
} from '@/lib/converters'
import { downloadJSON, readJSONFile, readSQLiteFile } from '@/lib/utils/file'
import { FileUpload } from '@/components/converter/FileUpload'
import { UserSelector } from '@/components/converter/UserSelector'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from '@/components/ui/alert-dialog'
import { useTranslation } from 'react-i18next'
import { getCurrentLanguage } from '@/lib/i18n/config'
import { LanguageSwitcher } from '@/components/ui/language-switcher'

export function ConverterPage() {
  const { t } = useTranslation()
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(
    Platform.MEMOS,
  )
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('api')
  const [file, setFile] = useState<File | null>(null)
  const [conversionResult, setConversionResult] = useState<any>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [showResultDialog, setShowResultDialog] = useState(false)

  // SQLite 模式相关状态
  const [sqliteData, setSqliteData] = useState<any>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [showUserSelector, setShowUserSelector] = useState(false)

  // API 模式相关状态
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [fetchProgress, setFetchProgress] = useState<FetchProgress | null>(null)

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setConversionResult(null)
  }, [])

  const handleConvert = useCallback(async () => {
    const converter = getConverter(selectedPlatform)
    if (!converter) {
      toast.error(t('errors.noConverter'))
      return
    }

    // 检查数据源是否有效
    if (dataSourceMode === 'file' && !file) return
    if (dataSourceMode === 'api' && (!apiBaseUrl || !apiToken)) return

    setIsConverting(true)
    setConversionResult(null)
    setFetchProgress(null)

    try {
      let data: any

      if (dataSourceMode === 'api') {
        // 通过 API 获取数据
        data = await fetchMemosFromApi(
          { baseUrl: apiBaseUrl, token: apiToken },
          setFetchProgress,
        )
      } else {
        // 从文件读取数据
        const fileName = file!.name.toLowerCase()
        if (fileName.endsWith('.json')) {
          // JSON 文件处理（保持原样）
          data = await readJSONFile(file!)
        } else if (
          fileName.endsWith('.db') ||
          fileName.endsWith('.sqlite') ||
          fileName.endsWith('.sqlite3')
        ) {
          // SQLite 文件处理
          data = await readSQLiteFile(file!)
          setSqliteData(data)

          if (data.users.length === 0) {
            throw new Error(t('errors.noUserData'))
          }

          if (data.users.length === 1) {
            // 只有一个用户，直接转换
            const result = converter.convert(data, data.users[0].id)
            setConversionResult(result)
            setShowResultDialog(true)

            if (result.success) {
              toast.success(
                t('toast.convertSuccess', { count: result.stats.converted }),
              )
            }
            setIsConverting(false) // 成功完成后重置加载状态
          } else {
            // 多个用户，显示选择界面
            setShowUserSelector(true)
            setIsConverting(false) // 等待用户选择
            return
          }
        } else {
          throw new Error(t('errors.unsupportedFileFormat'))
        }
      }

      // 继续处理 JSON 和单个用户的 SQLite 转换
      if (
        dataSourceMode === 'api' ||
        (dataSourceMode === 'file' &&
          file!.name.toLowerCase().endsWith('.json'))
      ) {
        if (!converter.validate(data)) {
          throw new Error(t('errors.invalidData'))
        }

        const result = converter.convert(data)
        setConversionResult(result)
        setShowResultDialog(true)

        if (result.errors.length > 0) {
          result.errors.forEach((error) => {
            toast.error(error)
          })
        }
        if (result.warnings.length > 0) {
          result.warnings.forEach((warning) => {
            toast.warning(warning, { duration: 8000 })
          })
        }
        if (result.success) {
          toast.success(
            t('toast.convertSuccess', { count: result.stats.converted }),
          )
        }
      }

      setIsConverting(false) // 成功完成后重置加载状态
    } catch (error) {
      toast.error((error as Error).message)
      setIsConverting(false)
    }
  }, [selectedPlatform, dataSourceMode, file, apiBaseUrl, apiToken])

  const handleUserConfirm = useCallback(async () => {
    if (selectedUserId === null || !sqliteData) return

    setShowUserSelector(false)
    setIsConverting(true)

    try {
      const converter = getConverter(selectedPlatform)
      if (!converter) {
        throw new Error('未找到对应的转换器')
      }

      const result = converter.convert(sqliteData, selectedUserId)
      setConversionResult(result)
      setShowResultDialog(true)

      if (result.errors.length > 0) {
        result.errors.forEach((error) => {
          toast.error(error)
        })
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
          toast.warning(warning, { duration: 8000 })
        })
      }
      if (result.success) {
        toast.success(`转换完成！成功转换 ${result.stats.converted} 条记录`)
      }
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsConverting(false)
    }
  }, [selectedUserId, sqliteData, selectedPlatform])

  const handleDownload = useCallback(() => {
    if (!conversionResult || !conversionResult.data) return

    const filename = `rote-export-${new Date().toISOString().split('T')[0]}.json`
    downloadJSON(conversionResult.data, filename)
  }, [conversionResult])

  const handlePlatformChange = useCallback((platform: string) => {
    setSelectedPlatform(platform as Platform)
    setFile(null)
    setConversionResult(null)
    setApiBaseUrl('')
    setApiToken('')
    setFetchProgress(null)
    setDataSourceMode('api')
    setSqliteData(null)
    setSelectedUserId(null)
    setShowUserSelector(false)
    setShowResultDialog(false)
    setIsConverting(false)
  }, [])

  return (
    <div className="min-h-screen bg-background py-4 md:py-12 lg:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div>
            <div className="flex gap-2 items-center">
              <Logo className="h-6 md:h-8 w-fit " color="#07C160" />
              <div className="text-xl md:text-3xl font-semibold tracking-tight ">
                {' '}
                | {t('common.dataMigration')}
              </div>
            </div>

            <div className="mt-1 md:mt-2 text-base md:text-lg font-light">
              {t('common.convertData')}
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start">
          <div className="lg:col-span-8">
            <Tabs
              value={selectedPlatform}
              onValueChange={handlePlatformChange}
              className="w-full"
            >
              <div className="mb-6 overflow-x-auto">
                <TabsList className="bg-muted/50 w-full sm:w-auto justify-start">
                  {converters.map((converter) => (
                    <TabsTrigger
                      key={converter.platform}
                      value={converter.platform}
                      className="flex-1 min-w-fit"
                    >
                      {converter.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {converters.map((converter) => (
                <TabsContent
                  key={converter.platform}
                  value={converter.platform}
                  className="mt-0"
                >
                  <Card className="p-4 shadow-sm">
                    <div className="flex flex-col gap-6">
                      <div>
                        <div className="text-xl font-semibold ">
                          {converter.name}{' '}
                          {t('converter.memosExport').replace('Memos ', '')}
                        </div>
                        <div className="font-light mt-1">
                          {typeof converter.description === 'string'
                            ? converter.description
                            : getCurrentLanguage() === 'zh'
                              ? converter.description.zh
                              : converter.description.en}
                        </div>
                      </div>

                      {/* 数据源模式选择 */}
                      {converter.supportedModes.length > 1 && (
                        <div className="space-y-3">
                          <Label className="text-sm font-medium ">
                            {t('converter.selectDataSource')}
                          </Label>
                          <Tabs
                            value={dataSourceMode}
                            onValueChange={(value) => {
                              setDataSourceMode(value as DataSourceMode)
                              setFetchProgress(null) // 切换数据源模式时重置获取进度
                            }}
                            className="w-full"
                          >
                            <TabsList className="bg-muted/50">
                              {converter.supportedModes.includes('api') && (
                                <TabsTrigger value="api">
                                  {t('converter.apiMode')}
                                </TabsTrigger>
                              )}
                              {converter.supportedModes.includes('file') && (
                                <TabsTrigger value="file">
                                  {t('converter.fileMode')}
                                </TabsTrigger>
                              )}
                            </TabsList>

                            {/* API 模式配置 */}
                            {converter.supportedModes.includes('api') && (
                              <TabsContent value="api" className="mt-4">
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label
                                      htmlFor="api-url"
                                      className="text-sm font-medium "
                                    >
                                      {t('converter.memosUrl')}
                                    </Label>
                                    <Input
                                      id="api-url"
                                      type="url"
                                      placeholder={t(
                                        'converter.memosUrlPlaceholder',
                                      )}
                                      value={apiBaseUrl}
                                      onChange={(e) =>
                                        setApiBaseUrl(e.target.value)
                                      }
                                    />
                                    <div className="text-xs font-light">
                                      {t('converter.memosUrlHint')}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label
                                      htmlFor="api-token"
                                      className="text-sm font-medium "
                                    >
                                      {t('converter.accessToken')}
                                    </Label>
                                    <Input
                                      id="api-token"
                                      type="password"
                                      placeholder={t(
                                        'converter.accessTokenPlaceholder',
                                      )}
                                      value={apiToken}
                                      onChange={(e) =>
                                        setApiToken(e.target.value)
                                      }
                                    />
                                    <div className="text-xs font-light">
                                      {t('converter.accessTokenHint')}
                                    </div>
                                  </div>
                                  {converter.apiDescription && (
                                    <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-sm font-light">
                                      <Globe className="h-4 w-4 mt-0.5 shrink-0" />
                                      <div>
                                        {typeof converter.apiDescription ===
                                        'string'
                                          ? converter.apiDescription
                                          : getCurrentLanguage() === 'zh'
                                            ? converter.apiDescription.zh
                                            : converter.apiDescription.en}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TabsContent>
                            )}

                            {/* 文件上传模式 */}
                            {converter.supportedModes.includes('file') && (
                              <TabsContent value="file" className="mt-4">
                                <FileUpload
                                  onFileSelect={handleFileSelect}
                                  acceptedFormats=".db,.sqlite,.sqlite3,.json"
                                />
                              </TabsContent>
                            )}
                          </Tabs>
                        </div>
                      )}

                      {/* 单一数据源模式显示 */}
                      {converter.supportedModes.length === 1 && (
                        <div className="space-y-4">
                          {converter.supportedModes.includes('api') && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label
                                  htmlFor="api-url"
                                  className="text-sm font-medium "
                                >
                                  {t('converter.memosUrl')}
                                </Label>
                                <Input
                                  id="api-url"
                                  type="url"
                                  placeholder={t(
                                    'converter.memosUrlPlaceholder',
                                  )}
                                  value={apiBaseUrl}
                                  onChange={(e) =>
                                    setApiBaseUrl(e.target.value)
                                  }
                                />
                                <div className="text-xs font-light">
                                  {t('converter.memosUrlHint')}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label
                                  htmlFor="api-token"
                                  className="text-sm font-medium "
                                >
                                  {t('converter.accessToken')}
                                </Label>
                                <Input
                                  id="api-token"
                                  type="password"
                                  placeholder={t(
                                    'converter.accessTokenPlaceholder',
                                  )}
                                  value={apiToken}
                                  onChange={(e) => setApiToken(e.target.value)}
                                />
                                <div className="text-xs font-light">
                                  {t('converter.accessTokenHint')}
                                </div>
                              </div>
                              {converter.apiDescription && (
                                <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-sm font-light">
                                  <Globe className="h-4 w-4 mt-0.5 shrink-0" />
                                  <div>
                                    {typeof converter.apiDescription ===
                                    'string'
                                      ? converter.apiDescription
                                      : getCurrentLanguage() === 'zh'
                                        ? converter.apiDescription.zh
                                        : converter.apiDescription.en}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {converter.supportedModes.includes('file') && (
                            <FileUpload
                              onFileSelect={handleFileSelect}
                              acceptedFormats=".db,.sqlite,.sqlite3,.json"
                            />
                          )}
                        </div>
                      )}

                      {/* 获取进度 */}
                      {fetchProgress && (
                        <div className="space-y-2 p-4 bg-muted rounded-lg border">
                          <div className="text-sm font-medium ">
                            {fetchProgress.message}
                          </div>
                        </div>
                      )}

                      {/* 用户选择界面 */}
                      {showUserSelector && sqliteData && (
                        <UserSelector
                          users={sqliteData.users}
                          selectedUserId={selectedUserId}
                          onUserSelect={setSelectedUserId}
                          onConfirm={handleUserConfirm}
                        />
                      )}

                      {/* 转换按钮 */}
                      {!showUserSelector && (
                        <div className="pt-4">
                          <Button
                            size="lg"
                            onClick={handleConvert}
                            disabled={
                              (dataSourceMode === 'file' && !file) ||
                              (dataSourceMode === 'api' &&
                                (!apiBaseUrl || !apiToken)) ||
                              isConverting
                            }
                            className="w-full sm:w-auto"
                          >
                            {isConverting ? (
                              <>
                                <div className="animate-spin mr-2 h-4 w-4 border-4 border-current border-t-transparent rounded-full" />
                                {dataSourceMode === 'api'
                                  ? t('converter.fetchingAndConverting')
                                  : t('converter.converting')}
                              </>
                            ) : (
                              <>
                                {dataSourceMode === 'api'
                                  ? t('converter.startConvert')
                                  : t('converter.startConvertFile')}

                                <ArrowRight className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="p-4 gap-2">
              <div className="text-lg font-semibold">{t('usage.title')}</div>
              {(() => {
                const converter = getConverter(selectedPlatform)
                // 确保 converter 和 usageInstructions 存在
                if (converter && converter.usageInstructions) {
                  const { steps, dataSourceOptions } =
                    converter.usageInstructions
                  const currentSteps = Array.isArray(steps)
                    ? steps
                    : getCurrentLanguage() === 'zh'
                      ? steps.zh
                      : steps.en
                  if (Array.isArray(currentSteps)) {
                    return (
                      <ol className="list-decimal pl-5 space-y-2 sm:space-y-3 text-sm font-light">
                        {currentSteps.map((step, index) => {
                          if (
                            index === 1 &&
                            dataSourceOptions &&
                            Array.isArray(dataSourceOptions)
                          ) {
                            return (
                              <li key={index}>
                                {t('usage.step2')}：
                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                  {dataSourceOptions.map((option) => (
                                    <li key={option.mode}>
                                      <strong>
                                        {option.mode === 'api'
                                          ? t('converter.apiMode')
                                          : t('converter.fileMode')}
                                      </strong>
                                      ：
                                      {typeof option.description === 'string'
                                        ? option.description
                                        : getCurrentLanguage() === 'zh'
                                          ? option.description.zh
                                          : option.description.en}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            )
                          }
                          return <li key={index}>{step}</li>
                        })}
                      </ol>
                    )
                  }
                }
                // 默认使用说明（兼容其他平台）
                return (
                  <ol className="list-decimal pl-5 space-y-2 sm:space-y-3 text-sm font-light">
                    <li>{t('usage.step1')}</li>
                    <li>
                      {t('usage.step2')}：
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>
                          <strong>{t('converter.apiMode')}</strong>：
                          {t('usage.apiOption')}
                        </li>
                        <li>
                          <strong>{t('converter.fileMode')}</strong>：
                          {t('usage.fileOption')}
                        </li>
                      </ul>
                    </li>
                    <li>{t('usage.step3')}</li>
                    <li>{t('usage.step4')}</li>
                    <li>{t('usage.step5')}</li>
                  </ol>
                )
              })()}
            </Card>

            <Footer />
          </div>
        </div>

        <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
          <AlertDialogContent>
            {conversionResult && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  {conversionResult.success ? (
                    <CheckCircle className="size-5" />
                  ) : (
                    <AlertTriangle className="size-5" />
                  )}
                  <div className="text-lg font-semibold">
                    {conversionResult.success
                      ? t('converter.convertSuccess')
                      : t('converter.convertComplete')}
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {conversionResult.success
                    ? t('converter.convertSuccessMessage')
                    : t('converter.convertCompleteMessage')}
                </div>

                <div className="flex gap-6">
                  <div className="flex flex-col gap-1">
                    <div className="text-2xl font-bold tabular-nums">
                      {conversionResult.stats.total}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('converter.totalRecords')}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-2xl font-bold tabular-nums">
                      {conversionResult.stats.converted}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('converter.successRecords')}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-2xl font-bold tabular-nums">
                      {conversionResult.stats.failed}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('converter.failedRecords')}
                    </div>
                  </div>
                </div>

                {/* 显示错误信息 */}
                {conversionResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-red-600">
                      {t('converter.errorDetails')}
                    </div>
                    <div className="text-xs text-red-500 bg-red-50 rounded-lg p-3 max-h-60 overflow-y-auto font-light">
                      <ul className="space-y-1 list-disc pl-4">
                        {conversionResult.errors.map(
                          (error: string, index: number) => (
                            <li key={index}>{error}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 显示警告信息 */}
                {conversionResult.warnings.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-yellow-600">
                      {t('converter.warnings')}
                    </div>
                    <div className="text-xs text-yellow-500 bg-yellow-50 font-light rounded-lg p-3 max-h-60 overflow-y-auto">
                      <ul className="space-y-1 list-disc pl-4">
                        {conversionResult.warnings.map(
                          (warning: string, index: number) => (
                            <li key={index}>{warning}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <AlertDialogCancel>{t('common.close')}</AlertDialogCancel>
                  {conversionResult?.success && (
                    <AlertDialogAction onClick={handleDownload}>
                      <Download className="mr-2 h-4 w-4" />
                      {t('common.downloadFile')}
                    </AlertDialogAction>
                  )}
                </div>
              </div>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
