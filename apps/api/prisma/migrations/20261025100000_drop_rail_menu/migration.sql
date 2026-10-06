-- The "rail" menu style was removed: people who picked it follow the company default again,
-- and companies that defaulted to it go back to the classic menu.
UPDATE "user_preferences" SET "menu_style" = NULL WHERE "menu_style" = 'rail';
UPDATE "company_settings" SET "default_menu_style" = 'classic' WHERE "default_menu_style" = 'rail';
