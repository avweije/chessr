<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240723091746 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE ignore_list (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, fen VARCHAR(255) NOT NULL, move VARCHAR(10) NOT NULL, INDEX IDX_124ECE8CA76ED395 (user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE ignore_list ADD CONSTRAINT FK_124ECE8CA76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('ALTER TABLE analysis DROP FOREIGN KEY FK_A7985196A76ED395');
        $this->addSql('DROP INDEX idx_f01d87b1a76ed395 ON analysis');
        $this->addSql('CREATE INDEX IDX_33C730A76ED395 ON analysis (user_id)');
        $this->addSql('ALTER TABLE analysis ADD CONSTRAINT FK_A7985196A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE ignore_list DROP FOREIGN KEY FK_124ECE8CA76ED395');
        $this->addSql('DROP TABLE ignore_list');
        $this->addSql('ALTER TABLE analysis DROP FOREIGN KEY FK_33C730A76ED395');
        $this->addSql('DROP INDEX idx_33c730a76ed395 ON analysis');
        $this->addSql('CREATE INDEX IDX_F01D87B1A76ED395 ON analysis (user_id)');
        $this->addSql('ALTER TABLE analysis ADD CONSTRAINT FK_33C730A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
    }
}
