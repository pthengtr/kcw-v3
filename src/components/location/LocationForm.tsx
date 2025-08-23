"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { locationSchema } from "./schema";

// IMPORTANT:
// Your resolver is Resolver<Input, Ctx, Output>
// so useForm MUST be <Input, Ctx, Output>
type LocationFormInput = z.input<typeof locationSchema>; // is_active?: boolean
type LocationFormValues = z.output<typeof locationSchema>; // is_active: boolean

export type LocationFormProps = {
  // defaultValues/reset accept INPUT shape (optional is_active)
  initial?: Partial<LocationFormInput>;
  // onSubmit receives OUTPUT shape (resolved defaults)
  onSubmit: (values: LocationFormValues) => Promise<void> | void;
  submitLabel?: string;
};

export default function LocationForm({
  initial,
  onSubmit,
  submitLabel = "บันทึก",
}: LocationFormProps) {
  const form = useForm<LocationFormInput, undefined, LocationFormValues>({
    resolver: zodResolver(locationSchema),
    // defaultValues must match INPUT type
    defaultValues: { is_active: true, ...initial },
  });

  const {
    handleSubmit,
    register,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = form;

  useEffect(() => {
    if (initial) reset({ is_active: true, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.location_uuid]);

  // watch returns INPUT type here; coerce to boolean with fallback
  const isActive = (watch("is_active") ?? true) as boolean;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="location_code">รหัส</Label>
          <Input
            id="location_code"
            placeholder="เช่น HQ, WH1"
            {...register("location_code")}
          />
          {errors.location_code && (
            <p className="text-sm text-red-600">
              {errors.location_code.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="location_name">ชื่อสถานที่</Label>
          <Input
            id="location_name"
            placeholder="สำนักงานใหญ่ / คลังสินค้าบางนา"
            {...register("location_name")}
          />
          {errors.location_name && (
            <p className="text-sm text-red-600">
              {errors.location_name.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="is_active">ใช้งานอยู่</Label>
        </div>
        <Switch
          id="is_active"
          checked={isActive}
          onCheckedChange={(v) =>
            setValue("is_active", v, { shouldValidate: true })
          }
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
