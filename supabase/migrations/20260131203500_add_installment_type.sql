alter table "public"."products" add column "installment_type" text not null default 'buyer';

comment on column "public"."products"."installment_type" is 'buyer: client pays interest (default), seller: store pays interest (interest-free display)';
