-- Add email_sent column to payments table
alter table "public"."payments" add column "email_sent" boolean not null default false;
