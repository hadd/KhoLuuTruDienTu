import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import { CloudUpload, File, X } from 'lucide-react'
import * as React from 'react'
import type { DropzoneOptions, FileRejection } from 'react-dropzone'
import { useDropzone } from 'react-dropzone'

import { cn } from '@/lib/utils/cn'

const dropzoneVariants = cva(
  'relative flex items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-border bg-background hover:bg-accent/50',
        error: 'border-destructive bg-destructive/5',
      },
      size: {
        sm: 'min-h-[120px] p-4',
        default: 'min-h-[200px] p-6',
        lg: 'min-h-[280px] p-8',
        compact: 'max-h-[100px] p-3',
      },
      isDragActive: {
        true: 'border-primary bg-primary/5 scale-[1.02]',
        false: '',
      },
      isDisabled: {
        true: 'cursor-not-allowed opacity-50',
        false: 'cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      isDragActive: false,
      isDisabled: false,
    },
  },
)

const fileItemVariants = cva(
  'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-card',
        error: 'border-destructive bg-destructive/5 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface DropzoneProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrop'>,
    VariantProps<typeof dropzoneVariants> {
  /**
   * Options to pass to react-dropzone
   */
  dropzoneOptions?: DropzoneOptions
  /**
   * Callback when files are accepted
   */
  onFilesAccepted?: (files: Array<File>) => void
  /**
   * Callback when files are rejected
   */
  onFilesRejected?: (fileRejections: Array<FileRejection>) => void
  /**
   * Show file preview list
   * @default true
   */
  showFilesList?: boolean
  /**
   * Maximum number of files to show in preview
   * @default 5
   */
  maxFilesPreview?: number
  /**
   * Custom content to display in the dropzone
   */
  children?: React.ReactNode
  /**
   * Title text
   */
  title?: string
  /**
   * Description text
   */
  description?: string
  /**
   * Value (controlled files list)
   */
  value?: Array<File>
  /**
   * Callback when value changes (controlled)
   */
  onValueChange?: (files: Array<File>) => void
}

const Dropzone = React.forwardRef<HTMLDivElement, DropzoneProps>(
  (
    {
      className,
      variant,
      size,
      dropzoneOptions,
      onFilesAccepted,
      onFilesRejected,
      showFilesList = true,
      maxFilesPreview = 5,
      children,
      title,
      description,
      value,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const [files, setFiles] = React.useState<Array<File>>(value || [])
    const [rejectedFiles, setRejectedFiles] = React.useState<
      Array<FileRejection>
    >([])

    // Sync internal state with controlled value
    React.useEffect(() => {
      if (value !== undefined) {
        setFiles(value)
      }
    }, [value])

    const onDrop = React.useCallback(
      (acceptedFiles: Array<File>, fileRejections: Array<FileRejection>) => {
        const newFiles = dropzoneOptions?.multiple
          ? [...files, ...acceptedFiles]
          : acceptedFiles

        setFiles(newFiles)
        setRejectedFiles(fileRejections)

        if (onValueChange) {
          onValueChange(newFiles)
        }

        if (acceptedFiles.length > 0 && onFilesAccepted) {
          onFilesAccepted(acceptedFiles)
        }

        if (fileRejections.length > 0 && onFilesRejected) {
          onFilesRejected(fileRejections)
        }
      },
      [
        files,
        dropzoneOptions?.multiple,
        onFilesAccepted,
        onFilesRejected,
        onValueChange,
      ],
    )

    const { getRootProps, getInputProps, isDragActive, isDragReject } =
      useDropzone({
        onDrop,
        ...dropzoneOptions,
      })

    const removeFile = React.useCallback(
      (fileToRemove: File) => {
        const newFiles = files.filter((file) => file !== fileToRemove)
        setFiles(newFiles)
        if (onValueChange) {
          onValueChange(newFiles)
        }
      },
      [files, onValueChange],
    )

    const removeRejectedFile = React.useCallback((index: number) => {
      setRejectedFiles((prev) => prev.filter((_, i) => i !== index))
    }, [])

    const displayVariant = isDragReject ? 'error' : variant

    const isCompact = size === 'compact'

    return (
      <div ref={ref} className="space-y-4">
        <div
          {...getRootProps({
            className: cn(
              dropzoneVariants({
                variant: displayVariant,
                size,
                isDragActive: isDragActive && !isDragReject,
                isDisabled: dropzoneOptions?.disabled,
              }),
              isCompact ? 'flex-row' : 'flex-col',
              className,
            ),
          })}
          {...props}
        >
          <input {...getInputProps()} />

          {children || (
            <>
              <div
                className={cn(
                  'flex items-center justify-center',
                  isCompact ? 'flex-row gap-3' : 'flex-col gap-2',
                )}
              >
                <CloudUpload
                  className={cn(
                    'transition-transform flex-shrink-0',
                    size === 'sm' && 'h-8 w-8',
                    size === 'default' && 'h-12 w-12',
                    size === 'lg' && 'h-16 w-16',
                    size === 'compact' && 'h-6 w-6',
                    isDragActive && !isDragReject && 'text-primary scale-110',
                    isDragReject && 'text-destructive',
                    !isDragActive && 'text-muted-foreground',
                  )}
                />

                <div className={cn(isCompact ? 'text-left' : 'text-center')}>
                  <p
                    className={cn(
                      'font-medium',
                      size === 'sm' && 'text-sm',
                      size === 'default' && 'text-base',
                      size === 'lg' && 'text-lg',
                      size === 'compact' && 'text-sm',
                      isDragActive && !isDragReject && 'text-primary',
                      isDragReject && 'text-destructive',
                    )}
                  >
                    {title ||
                      (isDragActive && !isDragReject
                        ? 'Drop files here'
                        : isDragReject
                          ? 'Invalid file type'
                          : 'Drag & drop files here')}
                  </p>
                  <p
                    className={cn(
                      'text-muted-foreground',
                      size === 'sm' && 'text-xs mt-1',
                      size === 'default' && 'text-sm mt-1',
                      size === 'lg' && 'text-base mt-2',
                      size === 'compact' && 'text-xs mt-0.5',
                    )}
                  >
                    {description || 'or click to browse'}
                  </p>
                </div>

                {!isCompact && dropzoneOptions?.accept && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Accepted:{' '}
                    {Object.values(dropzoneOptions.accept).flat().join(', ')}
                  </div>
                )}

                {!isCompact && dropzoneOptions?.maxSize && (
                  <div className="text-xs text-muted-foreground">
                    Max size:{' '}
                    {(dropzoneOptions.maxSize / 1024 / 1024).toFixed(1)} MB
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Accepted Files List */}
        {showFilesList && files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Files ({files.length}
              {dropzoneOptions?.maxFiles && ` / ${dropzoneOptions.maxFiles}`})
            </p>
            <div className="space-y-2">
              {files.slice(0, maxFilesPreview).map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={fileItemVariants()}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(file)
                    }}
                    className="flex-shrink-0 rounded p-1 hover:bg-muted transition-colors"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {files.length > maxFilesPreview && (
                <p className="text-xs text-muted-foreground">
                  +{files.length - maxFilesPreview} more files
                </p>
              )}
            </div>
          </div>
        )}

        {/* Rejected Files List */}
        {showFilesList && rejectedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">
              Rejected Files ({rejectedFiles.length})
            </p>
            <div className="space-y-2">
              {rejectedFiles.map((rejection, index) => (
                <div
                  key={`${rejection.file.name}-${index}`}
                  className={fileItemVariants({ variant: 'error' })}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <File className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium">
                        {rejection.file.name}
                      </p>
                      <p className="text-xs">
                        {rejection.errors.map((e) => e.message).join(', ')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeRejectedFile(index)
                    }}
                    className="flex-shrink-0 rounded p-1 hover:bg-destructive/20 transition-colors"
                    aria-label="Remove rejected file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
)

Dropzone.displayName = 'Dropzone'

export { Dropzone, dropzoneVariants }
