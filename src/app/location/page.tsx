"use client";

import LocationTable from "@/components/location/LocationTable";

export default function LocationPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold tracking-wide">สถานที่ (Location)</h1>
      <LocationTable />
    </div>
  );
}
