"use client";

import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

interface LoadingButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * Button that shows a spinner and disables itself while loading.
 * Prevents accidental double-submissions on async actions.
 */
export function LoadingButton({
  loading = false,
  children,
  disabled,
  className,
  variant,
  size,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || loading}
      className={cn("gap-1.5", className)}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </Button>
  );
}
