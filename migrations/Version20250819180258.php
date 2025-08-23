<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250819180258 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE analysis ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE archives ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE downloads ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE eco ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE "group" ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE ignore_list ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE moves ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE opponent ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE opponent_game ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE opponent_move ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE repertoire ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE repertoire_group ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
        $this->addSql('ALTER TABLE settings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
    }
}
