<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250921101324 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE repertoire ADD focused BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE repertoire ADD notes VARCHAR(1024) DEFAULT NULL');
        $this->addSql('ALTER TABLE repertoire ALTER practice_count SET DEFAULT 0');
        $this->addSql('ALTER TABLE repertoire ALTER practice_failed SET DEFAULT 0');
        $this->addSql('ALTER TABLE repertoire ALTER practice_in_arow SET DEFAULT 0');
        $this->addSql('ALTER TABLE repertoire ALTER auto_play SET DEFAULT false');
        $this->addSql('ALTER TABLE repertoire ALTER exclude SET DEFAULT false');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('ALTER TABLE repertoire DROP focused');
        $this->addSql('ALTER TABLE repertoire DROP notes');
        $this->addSql('ALTER TABLE repertoire ALTER auto_play DROP DEFAULT');
        $this->addSql('ALTER TABLE repertoire ALTER exclude DROP DEFAULT');
        $this->addSql('ALTER TABLE repertoire ALTER practice_count DROP DEFAULT');
        $this->addSql('ALTER TABLE repertoire ALTER practice_failed DROP DEFAULT');
        $this->addSql('ALTER TABLE repertoire ALTER practice_in_arow DROP DEFAULT');
    }
}
