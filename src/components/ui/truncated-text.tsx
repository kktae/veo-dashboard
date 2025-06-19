import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { truncateText } from '@/lib/video-utils';

interface TruncatedTextProps {
  text: string;
  maxLength: number;
  className?: string;
  tooltipSide?: 'left' | 'right' | 'top' | 'bottom';
  tooltipMaxWidth?: string;
  children?: (truncatedText: string) => React.ReactNode;
}

export function TruncatedText({ 
  text, 
  maxLength, 
  className = '',
  tooltipSide = 'top',
  tooltipMaxWidth = 'max-w-sm',
  children 
}: TruncatedTextProps) {
  const truncated = truncateText(text, maxLength);
  const needsTooltip = text.length > maxLength;

  const content = children ? children(truncated) : (
    <span className={className}>{truncated}</span>
  );

  if (!needsTooltip) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-pointer">
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className={tooltipMaxWidth}>
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 