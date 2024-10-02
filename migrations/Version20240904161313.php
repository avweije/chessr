<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240904161313 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        //$this->addSql('ALTER TABLE evaluation CHANGE fen fen VARCHAR(255) NOT NULL COLLATE `utf8mb4_bin`');
        //$this->addSql('ALTER TABLE moves CHANGE fen fen VARCHAR(255) NOT NULL COLLATE `utf8mb4_bin`');
        //$this->addSql('ALTER TABLE repertoire CHANGE fen_before fen_before VARCHAR(255) NOT NULL COLLATE `utf8mb4_bin`, CHANGE fen_after fen_after VARCHAR(255) NOT NULL COLLATE `utf8mb4_bin`');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        //$this->addSql('ALTER TABLE evaluation CHANGE fen fen VARBINARY(255) NOT NULL');
        //$this->addSql('ALTER TABLE moves CHANGE fen fen VARBINARY(255) NOT NULL');
        //$this->addSql('ALTER TABLE repertoire CHANGE fen_before fen_before VARBINARY(255) NOT NULL, CHANGE fen_after fen_after VARBINARY(255) NOT NULL');
    }
}
