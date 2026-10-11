import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { classNames } from "primereact/utils";
import { ApiError } from "@/lib/apiClient";
import { logger } from "@/lib/logger";
import { createItem } from "./itemsApi";
import { CATEGORIES, itemCreateSchema, type ItemCreate } from "./schema";

const categoryOptions = CATEGORIES.map((c) => ({ label: c.charAt(0) + c.slice(1).toLowerCase(), value: c }));

export function ItemForm() {
  const toast = useRef<Toast>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemCreate>({
    resolver: zodResolver(itemCreateSchema),
    mode: "onTouched",
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = async (data: ItemCreate) => {
    try {
      const item = await createItem(data);
      logger.info("item created", { id: item.id });
      toast.current?.show({ severity: "success", summary: "Item saved", detail: item.name });
      reset();
    } catch (err) {
      const detail = err instanceof ApiError ? err.message : "Could not reach the server. Try again.";
      toast.current?.show({ severity: "error", summary: "Item not saved", detail });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="form">
      <Toast ref={toast} />

      <div className="field">
        <label htmlFor="name">Name</label>
        <InputText id="name" {...register("name")} className={classNames({ "p-invalid": errors.name })} />
        {errors.name && <small className="p-error">{errors.name.message}</small>}
      </div>

      <div className="field">
        <label htmlFor="category">Category</label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Dropdown
              inputId="category"
              value={field.value}
              options={categoryOptions}
              onChange={(e) => field.onChange(e.value)}
              onBlur={field.onBlur}
              placeholder="Select a category"
              className={classNames({ "p-invalid": errors.category })}
            />
          )}
        />
        {errors.category && <small className="p-error">{errors.category.message}</small>}
      </div>

      <div className="field">
        <label htmlFor="quantity">Quantity</label>
        <Controller
          name="quantity"
          control={control}
          render={({ field }) => (
            <InputNumber
              inputId="quantity"
              value={field.value ?? null}
              onValueChange={(e) => field.onChange(e.value ?? undefined)}
              onBlur={field.onBlur}
              min={0}
              useGrouping={false}
              className={classNames({ "p-invalid": errors.quantity })}
            />
          )}
        />
        {errors.quantity && <small className="p-error">{errors.quantity.message}</small>}
      </div>

      <div className="field">
        <label htmlFor="description">Description (optional)</label>
        <InputTextarea id="description" rows={3} autoResize {...register("description")} />
        {errors.description && <small className="p-error">{errors.description.message}</small>}
      </div>

      <Button type="submit" label="Save item" loading={isSubmitting} />
    </form>
  );
}
