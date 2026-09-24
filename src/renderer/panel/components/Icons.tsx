import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps): IconProps {
  return {
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props
  }
}

export const PlusIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const ListIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
)

export const GearIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
  </svg>
)

export const ChevronRightIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export const ChevronDownIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const SendIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M4 12l16-8-6 16-3.5-6.5L4 12z" />
  </svg>
)

export const StopIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
  </svg>
)

export const CameraIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M4 8h2.5l1.6-2.4A1 1 0 0 1 8.9 5h6.2a1 1 0 0 1 .8.6L17.5 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
)

export const TrashIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M7 7l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12" />
  </svg>
)

export const CopyIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5H6a1 1 0 0 0-1 1v9" />
  </svg>
)

export const RefreshIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M20 11a8 8 0 1 0-2.3 6.4M20 5v6h-6" />
  </svg>
)

export const CheckIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M5 13l4.5 4.5L19 6.5" />
  </svg>
)

export const CloseIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const SearchIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l4.5 4.5" />
  </svg>
)

export const DownloadIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
  </svg>
)

export const FolderIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M4 7a1 1 0 0 1 1-1h4.2a1 1 0 0 1 .8.4L11.5 8H19a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" />
  </svg>
)

export const SparkleIcon = (props: IconProps): JSX.Element => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" {...props}>
    <path d="M12 2.6l1.82 5.4a1 1 0 0 0 .62.62l5.4 1.82-5.4 1.82a1 1 0 0 0-.62.62L12 18.28l-1.82-5.4a1 1 0 0 0-.62-.62l-5.4-1.82 5.4-1.82a1 1 0 0 0 .62-.62L12 2.6z" />
    <circle cx="18.6" cy="18.4" r="1.9" opacity="0.85" />
  </svg>
)

export const AlertIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M12 8v5m0 3h.01M10.3 4.2L2.7 17.5A2 2 0 0 0 4.4 20.5h15.2a2 2 0 0 0 1.7-3l-7.6-13.3a2 2 0 0 0-3.4 0z" />
  </svg>
)

export const ImageIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M5 17l4.2-4.2L13 16.6l2.6-2.6L20 18" />
  </svg>
)

export const ToolIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M14.5 4.5a4.2 4.2 0 0 0 5.3 5.6l-7.6 7.6a2.1 2.1 0 1 1-3-3l7.6-7.6a4.2 4.2 0 0 1-2.3-2.6z" />
    <path d="M6.5 6.5l2 2" />
  </svg>
)

export const ServerIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <rect x="4" y="4.5" width="16" height="6" rx="1.6" />
    <rect x="4" y="13.5" width="16" height="6" rx="1.6" />
    <path d="M7.5 7.5h.01M7.5 16.5h.01" />
  </svg>
)

export const PlugIcon = (props: IconProps): JSX.Element => (
  <svg {...base(props)}>
    <path d="M9 3.5v5M15 3.5v5" />
    <path d="M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0z" />
    <path d="M12 17v3.5" />
  </svg>
)
