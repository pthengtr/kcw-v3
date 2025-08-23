export type LocationRow = {
  location_uuid: string;
  location_code: string;
  location_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LocationInput = {
  location_uuid?: string;
  location_code: string;
  location_name: string;
  is_active: boolean;
};
