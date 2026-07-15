CREATE TABLE "sohoa_app"."physical_warehouse_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"level_id" uuid,
	"name" varchar(500) NOT NULL,
	"image_url" text,
	"address" text,
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."physical_warehouse_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_name" varchar(255) NOT NULL,
	"level_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."physical_warehouse_items" ADD CONSTRAINT "physical_warehouse_items_parent_id_physical_warehouse_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "sohoa_app"."physical_warehouse_items"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."physical_warehouse_items" ADD CONSTRAINT "physical_warehouse_items_level_id_physical_warehouse_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "sohoa_app"."physical_warehouse_levels"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_physical_warehouse_items_parent_id" ON "sohoa_app"."physical_warehouse_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_physical_warehouse_items_level_id" ON "sohoa_app"."physical_warehouse_items" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "idx_physical_warehouse_items_name" ON "sohoa_app"."physical_warehouse_items" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_physical_warehouse_levels_order" ON "sohoa_app"."physical_warehouse_levels" USING btree ("level_order");--> statement-breakpoint
CREATE INDEX "idx_physical_warehouse_levels_order" ON "sohoa_app"."physical_warehouse_levels" USING btree ("level_order");