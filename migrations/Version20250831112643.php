<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250831112643 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE evaluations.evaluation ADD cp INT DEFAULT NULL');
        $this->addSql('ALTER TABLE evaluations.evaluation ADD mate SMALLINT DEFAULT NULL');
        $this->addSql('ALTER TABLE evaluations.evaluation DROP score');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('ALTER TABLE evaluations.evaluation ADD score INT NOT NULL');
        $this->addSql('ALTER TABLE evaluations.evaluation DROP cp');
        $this->addSql('ALTER TABLE evaluations.evaluation DROP mate');
    }
}
